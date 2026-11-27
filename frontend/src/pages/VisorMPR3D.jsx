/**
- VisorMPR3D.jsx — MI_PACS
- ---------------------------------------------------------
- Reconstrucción Multiplanar 3D (Axial, Coronal, Sagital) en Cornerstone3D v5.10.8
- Con carga adaptativa (LAN / Túnel), anti-congelamiento, selector de series, marcadores EN/ES, Brillo/Contraste dinámico y Escudo de Memoria
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import * as csCore from "@cornerstonejs/core";
import * as csTools from "@cornerstonejs/tools";
import { initCornerstone, setCornerstoneAuthToken } from "../cornerstoneInit";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE = isLocalhost
  ? "http://192.168.5.21:8000"
  : import.meta.env.VITE_API_URL || window.API_URL || window.location.origin;

const CT_PRESETS = {
  brain: { labelEs: "Cerebro", labelEn: "Brain", ww: 80, wc: 40 },
  soft: { labelEs: "Tejido Blando", labelEn: "Soft Tissue", ww: 350, wc: 50 },
  bone: { labelEs: "Hueso", labelEn: "Bone", ww: 2000, wc: 400 },
  lung: { labelEs: "Pulmón", labelEn: "Lung", ww: 1500, wc: -600 },
};

const VIEWPORT_IDS = ["AXIAL_VIEWPORT", "SAGITTAL_VIEWPORT", "CORONAL_VIEWPORT"];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function formatearFechaDicom(rawDate) {
  if (!rawDate) return "N/A";
  const clean = String(rawDate).replace(/[^0-9]/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return rawDate;
}

function cargarConTimeout(imageId, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout descargando corte (${timeoutMs} ms)`));
    }, timeoutMs);

    csCore.imageLoader
      .loadAndCacheImage(imageId)
      .then((img) => {
        clearTimeout(timer);
        resolve(img);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function cargarCortesPorLotes(
  imageIds,
  onProgress,
  isCancelledFn,
  { concurrencia = 8, pausaMs = 0, maxReintentos = 4 } = {}
) {
  let completados = 0;
  let indiceActual = 0;

  const worker = async () => {
    while (indiceActual < imageIds.length) {
      if (isCancelledFn()) return;
      const idx = indiceActual++;
      const id = imageIds[idx];
      let intentos = 0;

      while (intentos < maxReintentos) {
        if (isCancelledFn()) return;
        try {
          await cargarConTimeout(id, 12000);
          break;
        } catch (err) {
          intentos++;
          try {
            csCore.cache.removeImageLoadObject(id);
          } catch (e) {}
          if (intentos >= maxReintentos) throw err;
          await new Promise((r) => setTimeout(r, 500 * intentos));
        }
      }

      completados++;
      if (onProgress && !isCancelledFn()) {
        onProgress(completados, imageIds.length);
      }

      if (pausaMs > 0 && indiceActual < imageIds.length && !isCancelledFn()) {
        await new Promise((r) => setTimeout(r, pausaMs));
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrencia, imageIds.length) }, () => worker());
  await Promise.all(workers);
}

function vectorALetraAnatomica(vec, isEn) {
  if (!Array.isArray(vec) || vec.length < 3) return { code: "", label: "" };
  const [x, y, z] = vec;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);

  if (ax >= ay && ax >= az) {
    return x >= 0
      ? { code: isEn ? "L" : "I", label: isEn ? "Left" : "Izquierda" }
      : { code: isEn ? "R" : "D", label: isEn ? "Right" : "Derecha" };
  }
  if (ay >= ax && ay >= az) {
    return y >= 0
      ? { code: "P", label: "Posterior" }
      : { code: "A", label: "Anterior" };
  }
  return z >= 0
    ? { code: "S", label: "Superior" }
    : { code: "I", label: "Inferior" };
}

function calcularMarcadoresViewport(vp, isEn) {
  if (!vp || typeof vp.getCamera !== "function") return null;
  const camera = vp.getCamera();
  if (!camera?.viewUp || !camera?.viewPlaneNormal) return null;

  const topVec = camera.viewUp;
  const bottomVec = [-topVec[0], -topVec[1], -topVec[2]];
  const n = camera.viewPlaneNormal;

  const rightVec = [
    topVec[1] * n[2] - topVec[2] * n[1],
    topVec[2] * n[0] - topVec[0] * n[2],
    topVec[0] * n[1] - topVec[1] * n[0],
  ];
  const leftVec = [-rightVec[0], -rightVec[1], -rightVec[2]];

  return {
    top: vectorALetraAnatomica(topVec, isEn),
    bottom: vectorALetraAnatomica(bottomVec, isEn),
    left: vectorALetraAnatomica(leftVec, isEn),
    right: vectorALetraAnatomica(rightVec, isEn),
  };
}

function ordenarCortesEspacialmente(imageIds) {
  const conPosicion = imageIds.map((id, idx) => {
    const plane = csCore.metaData.get("imagePlaneModule", id);
    const general = csCore.metaData.get("generalImageModule", id);
    const ipp = plane?.imagePositionPatient;
    const iop = plane?.imageOrientationPatient;

    let zProj = null;
    if (Array.isArray(ipp) && ipp.length >= 3 && Array.isArray(iop) && iop.length >= 6) {
      const normal = [
        iop[1] * iop[5] - iop[2] * iop[4],
        iop[2] * iop[3] - iop[0] * iop[5],
        iop[0] * iop[4] - iop[1] * iop[3],
      ];
      zProj = ipp[0] * normal[0] + ipp[1] * normal[1] + ipp[2] * normal[2];
    } else if (typeof plane?.sliceLocation === "number") {
      zProj = plane.sliceLocation;
    }

    return {
      id,
      zProj,
      instanceNumber: general?.instanceNumber ?? idx,
      originalIndex: idx,
    };
  });

  const todosConZ = conPosicion.every((item) => typeof item.zProj === "number" && !Number.isNaN(item.zProj));

  conPosicion.sort((a, b) => {
    if (todosConZ) return a.zProj - b.zProj;
    if (a.instanceNumber !== b.instanceNumber) return a.instanceNumber - b.instanceNumber;
    return a.originalIndex - b.originalIndex;
  });

  let realZStep = 5.0;
  if (todosConZ && conPosicion.length >= 2) {
    const diff = Math.abs(conPosicion[1].zProj - conPosicion[0].zProj);
    if (diff > 0.1) {
      realZStep = diff;
    }
  }

  return {
    sortedIds: conPosicion.map((item) => item.id),
    realZStep,
  };
}

function vincularHerramientasMPR(renderingEngineId, toolGroupId, modoInicial = "crosshairs") {
  const prevToolGroup = csTools.ToolGroupManager.getToolGroup(toolGroupId);
  if (prevToolGroup) {
    csTools.ToolGroupManager.destroyToolGroup(toolGroupId);
  }

  const toolGroup = csTools.ToolGroupManager.createToolGroup(toolGroupId);
  VIEWPORT_IDS.forEach((vpId) => toolGroup.addViewport(vpId, renderingEngineId));

  if (csTools.CrosshairsTool) {
    try { csTools.addTool(csTools.CrosshairsTool); } catch (e) {}
    toolGroup.addTool(csTools.CrosshairsTool.toolName);
    if (modoInicial === "crosshairs") {
      toolGroup.setToolActive(csTools.CrosshairsTool.toolName, {
        bindings: [{ mouseButton: csTools.Enums.MouseBindings.Primary }],
      });
    } else {
      toolGroup.setToolEnabled(csTools.CrosshairsTool.toolName);
    }
  }
  if (csTools.ZoomTool) {
    try { csTools.addTool(csTools.ZoomTool); } catch (e) {}
    toolGroup.addTool(csTools.ZoomTool.toolName);
    toolGroup.setToolActive(csTools.ZoomTool.toolName, {
      bindings: [{ mouseButton: csTools.Enums.MouseBindings.Secondary }],
    });
  }
  if (csTools.PanTool) {
    try { csTools.addTool(csTools.PanTool); } catch (e) {}
    toolGroup.addTool(csTools.PanTool.toolName);
    toolGroup.setToolActive(csTools.PanTool.toolName, {
      bindings: [{ mouseButton: csTools.Enums.MouseBindings.Auxiliary }],
    });
  }
}

function OrientationOverlay({ markers }) {
  if (!markers) return null;
  return (
    <>
      {markers.top?.code && (
        <div style={{ ...styles.orientBadge, top: "8px", left: "50%", transform: "translateX(-50%)" }} title={markers.top.label}>
          {markers.top.code}
        </div>
      )}
      {markers.bottom?.code && (
        <div style={{ ...styles.orientBadge, bottom: "8px", left: "50%", transform: "translateX(-50%)" }} title={markers.bottom.label}>
          {markers.bottom.code}
        </div>
      )}
      {markers.left?.code && (
        <div style={{ ...styles.orientBadge, left: "10px", top: "50%", transform: "translateY(-50%)" }} title={markers.left.label}>
          {markers.left.code}
        </div>
      )}
      {markers.right?.code && (
        <div style={{ ...styles.orientBadge, right: "10px", top: "50%", transform: "translateY(-50%)" }} title={markers.right.label}>
          {markers.right.code}
        </div>
      )}
    </>
  );
}

export default function VisorMPR3D() {
  const { id: currentId } = useParams();
  const location = useLocation();
  const { i18n } = useTranslation();

  const [storedLang, setStoredLang] = useState(() => localStorage.getItem("i18nextLng") || "");
  const effectiveLang = i18n.language || storedLang || "es";
  const isEn = effectiveLang.toLowerCase().startsWith("en");

  const searchParams = new URLSearchParams(location.search);
  const tokenUrl = searchParams.get("token");
  const idRealUrl = searchParams.get("id_real");
  const rawLocalToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const cleanLocalToken = rawLocalToken.replace(/['"]+/g, "").trim();

  const activeToken = tokenUrl || cleanLocalToken;
  const isGuest = !!tokenUrl;

  const [cargando, setCargando] = useState(true);
  const [progresoCarga, setProgresoCarga] = useState({ actual: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [seriesDisponibles, setSeriesDisponibles] = useState([]);
  const [serieIdx, setSerieIdx] = useState(0);
  const [presetActivo, setPresetActivo] = useState("brain");
  const [toolMode, setToolMode] = useState("crosshairs");
  const [ventanaActual, setVentanaActual] = useState({ ww: 80, wc: 40 });
  const [velocidadRueda, setVelocidadRueda] = useState(1);
  const [mostrarInfo, setMostrarInfo] = useState(true);
  const [infoPaciente, setInfoPaciente] = useState(null);
  const [orientaciones, setOrientaciones] = useState({
    AXIAL_VIEWPORT: null,
    CORONAL_VIEWPORT: null,
    SAGITTAL_VIEWPORT: null,
  });

  const axialRef = useRef(null);
  const sagittalRef = useRef(null);
  const coronalRef = useRef(null);

  const sliceSpacingRef = useRef(5.0);
  const velocidadRef = useRef(1);
  const volumeBoundsRef = useRef(null);
  const toolModeRef = useRef("crosshairs");
  const ventanaRef = useRef({ ww: 80, wc: 40 });
  const defaultPresetRef = useRef("brain");

  const renderingEngineId = "my_mpr_rendering_engine";
  const toolGroupId = "mpr_tool_group";

  useEffect(() => {
    const syncLang = () => setStoredLang(localStorage.getItem("i18nextLng") || "");
    window.addEventListener("storage", syncLang);
    return () => window.removeEventListener("storage", syncLang);
  }, []);

  const actualizarOrientaciones = useCallback((langIsEn) => {
    const engine = csCore.getRenderingEngine(renderingEngineId);
    if (!engine) return;

    setOrientaciones({
      AXIAL_VIEWPORT: calcularMarcadoresViewport(engine.getViewport("AXIAL_VIEWPORT"), langIsEn),
      CORONAL_VIEWPORT: calcularMarcadoresViewport(engine.getViewport("CORONAL_VIEWPORT"), langIsEn),
      SAGITTAL_VIEWPORT: calcularMarcadoresViewport(engine.getViewport("SAGITTAL_VIEWPORT"), langIsEn),
    });
  }, []);

  useEffect(() => {
    actualizarOrientaciones(isEn);
  }, [isEn, actualizarOrientaciones]);

  const aplicarVoiRango = useCallback((ww, wc) => {
    const safeWW = Math.max(1, Math.round(ww));
    const safeWC = Math.round(wc);
    ventanaRef.current = { ww: safeWW, wc: safeWC };
    setVentanaActual({ ww: safeWW, wc: safeWC });

    const engine = csCore.getRenderingEngine(renderingEngineId);
    if (!engine) return;

    const lower = safeWC - safeWW / 2;
    const upper = safeWC + safeWW / 2;

    VIEWPORT_IDS.forEach((vpId) => {
      const vp = engine.getViewport(vpId);
      if (vp && typeof vp.setProperties === "function") {
        try {
          vp.setProperties({ voiRange: { lower, upper } });
          vp.render();
        } catch (e) {}
      }
    });
  }, []);

  const cambiarModoHerramienta = useCallback((nuevoModo) => {
    setToolMode(nuevoModo);
    toolModeRef.current = nuevoModo;

    const toolGroup = csTools.ToolGroupManager.getToolGroup(toolGroupId);
    if (!toolGroup || !csTools.CrosshairsTool) return;

    try {
      if (nuevoModo === "crosshairs") {
        toolGroup.setToolActive(csTools.CrosshairsTool.toolName, {
          bindings: [{ mouseButton: csTools.Enums.MouseBindings.Primary }],
        });
      } else {
        toolGroup.setToolEnabled(csTools.CrosshairsTool.toolName);
      }
    } catch (e) {}
  }, []);

  const cambiarVelocidad = (mult) => {
    setVelocidadRueda(mult);
    velocidadRef.current = mult;
  };

  const aplicarVentanaCT = useCallback((presetKey) => {
    setPresetActivo(presetKey);
    const preset = CT_PRESETS[presetKey];
    if (!preset) return;
    aplicarVoiRango(preset.ww, preset.wc);
  }, [aplicarVoiRango]);

  const reiniciarVista = useCallback(() => {
    const engine = csCore.getRenderingEngine(renderingEngineId);
    if (!engine) return;

    const targetPresetKey = CT_PRESETS[presetActivo] ? presetActivo : defaultPresetRef.current;
    const preset = CT_PRESETS[targetPresetKey] || CT_PRESETS.brain;
    setPresetActivo(targetPresetKey);

    const lower = preset.wc - preset.ww / 2;
    const upper = preset.wc + preset.ww / 2;
    ventanaRef.current = { ww: preset.ww, wc: preset.wc };
    setVentanaActual({ ww: preset.ww, wc: preset.wc });

    engine.resize(true);
    VIEWPORT_IDS.forEach((vpId) => {
      const vp = engine.getViewport(vpId);
      if (vp) {
        vp.resetCamera();
        if (typeof vp.setProperties === "function") {
          try {
            vp.setProperties({ voiRange: { lower, upper } });
          } catch (e) {}
        }
      }
    });

    try {
      vincularHerramientasMPR(renderingEngineId, toolGroupId, toolModeRef.current);
    } catch (e) {}

    actualizarOrientaciones((localStorage.getItem("i18nextLng") || i18n.language || "").toLowerCase().startsWith("en"));
    engine.renderViewports(VIEWPORT_IDS);
  }, [presetActivo, actualizarOrientaciones, i18n.language]);

  useEffect(() => {
    let arrastrandoWL = false;
    let startX = 0;
    let startY = 0;
    let startWW = 80;
    let startWC = 40;

    const elementos = [axialRef.current, coronalRef.current, sagittalRef.current].filter(Boolean);

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (toolModeRef.current !== "wl" && !e.shiftKey) return;

      e.preventDefault();
      e.stopPropagation();

      arrastrandoWL = true;
      startX = e.clientX;
      startY = e.clientY;
      startWW = ventanaRef.current.ww;
      startWC = ventanaRef.current.wc;
    };

    const onMouseMove = (e) => {
      if (!arrastrandoWL) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const sensibilidad = Math.max(1, Math.abs(startWW) / 220);
      const nextWW = Math.max(1, Math.round(startWW + dx * sensibilidad));
      const nextWC = Math.round(startWC + dy * sensibilidad);

      setPresetActivo("custom");
      aplicarVoiRango(nextWW, nextWC);
    };

    const onMouseUp = () => {
      arrastrandoWL = false;
    };

    elementos.forEach((el) => el.addEventListener("mousedown", onMouseDown, { capture: true }));
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      elementos.forEach((el) => el.removeEventListener("mousedown", onMouseDown, { capture: true }));
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [aplicarVoiRango]);

  useEffect(() => {
    let cancelado = false;
    const volumeId = `cornerstoneStreamingImageVolume:my_mpr_volume_s${serieIdx}`;
    const enIngles = (localStorage.getItem("i18nextLng") || i18n.language || "").toLowerCase().startsWith("en");

    const manejarRueda = (viewportId) => (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dir = Math.sign(e.deltaY);
      if (dir === 0) return;

      const engine = csCore.getRenderingEngine(renderingEngineId);
      if (!engine) return;
      const vp = engine.getViewport(viewportId);
      if (!vp) return;

      const camera = vp.getCamera();
      if (!camera?.viewPlaneNormal || !camera?.focalPoint || !camera?.position) return;

      const baseMm =
        viewportId === "AXIAL_VIEWPORT"
          ? sliceSpacingRef.current
          : Math.max(sliceSpacingRef.current, 4.0);

      const step = dir * baseMm * velocidadRef.current;
      const [nx, ny, nz] = camera.viewPlaneNormal;

      let nextFocal = [
        camera.focalPoint[0] + nx * step,
        camera.focalPoint[1] + ny * step,
        camera.focalPoint[2] + nz * step,
      ];

      const bounds = volumeBoundsRef.current;
      if (Array.isArray(bounds) && bounds.length === 6) {
        nextFocal = [
          clamp(nextFocal[0], bounds[0], bounds[1]),
          clamp(nextFocal[1], bounds[2], bounds[3]),
          clamp(nextFocal[2], bounds[4], bounds[5]),
        ];
      }

      const deltaVec = [
        nextFocal[0] - camera.focalPoint[0],
        nextFocal[1] - camera.focalPoint[1],
        nextFocal[2] - camera.focalPoint[2],
      ];

      const nextPos = [
        camera.position[0] + deltaVec[0],
        camera.position[1] + deltaVec[1],
        camera.position[2] + deltaVec[2],
      ];

      vp.setCamera({ focalPoint: nextFocal, position: nextPos });
      engine.renderViewports(VIEWPORT_IDS);
    };

    const wheelHandlers = [
      { el: axialRef.current, fn: manejarRueda("AXIAL_VIEWPORT") },
      { el: coronalRef.current, fn: manejarRueda("CORONAL_VIEWPORT") },
      { el: sagittalRef.current, fn: manejarRueda("SAGITTAL_VIEWPORT") },
    ];

    wheelHandlers.forEach(({ el, fn }) => {
      if (el) el.addEventListener("wheel", fn, { passive: false, capture: true });
    });

    const inicializarMPR = async () => {
      try {
        setCargando(true);
        setErrorMsg("");
        setProgresoCarga({ actual: 0, total: 0 });

        if (typeof SharedArrayBuffer === "undefined") {
          throw new Error(
            enIngles
              ? "SharedArrayBuffer is disabled. Check COOP/COEP headers."
              : "SharedArrayBuffer deshabilitado. Revisa las cabeceras COOP/COEP."
          );
        }

        setCornerstoneAuthToken(isGuest ? "" : activeToken);
        await initCornerstone();

        const urlFetch = isGuest
          ? `${API_BASE}/api/secure-links/imagenes/${activeToken}`
          : `${API_BASE}/api/estudios/${currentId}/imagenes`;

        const headersFetch = isGuest ? {} : { Authorization: `Bearer ${activeToken}` };
        const response = await fetch(urlFetch, { headers: headersFetch });
        if (!response.ok) {
          throw new Error(enIngles ? "Authentication or server error" : "Error de autenticación o servidor");
        }

        const data = await response.json();
        if (!data || data.length === 0) {
          throw new Error(enIngles ? "No images found" : "No hay imágenes en este estudio");
        }

        const candidatas = data
          .filter((s) => (s.imagenes?.length || 0) >= 3)
          .sort((a, b) => (b.imagenes?.length || 0) - (a.imagenes?.length || 0));

        if (candidatas.length === 0) {
          throw new Error(
            enIngles
              ? "This study has no volumetric series (minimum 3 slices required for 3D MPR)."
              : "Este estudio no tiene series volumétricas (se requieren al menos 3 cortes para MPR 3D)."
          );
        }

        if (!cancelado) {
          setSeriesDisponibles(candidatas);
        }

        const idxSeguro = Math.min(serieIdx, candidatas.length - 1);
        const seriePrincipal = candidatas[idxSeguro];

        const rawImageIds = seriePrincipal.imagenes.map((img) =>
          isGuest
            ? `wadouri:${API_BASE}/api/secure-links/stream/${img.id}?token=${activeToken}`
            : `wadouri:${API_BASE}/api/dicom/stream/${img.id}?token=${activeToken}`
        );

        setProgresoCarga({ actual: 0, total: rawImageIds.length });

        // Carga paralela sin pausas muertas (8 hilos en LAN, 6 hilos por túnel con anti-congelamiento de 12 s)
        const esMasivo = rawImageIds.length >= 800;
        await cargarCortesPorLotes(
          rawImageIds,
          (actual, total) => setProgresoCarga({ actual, total }),
          () => cancelado,
          isLocalhost
            ? { concurrencia: esMasivo ? 6 : 8, pausaMs: 0, maxReintentos: 3 }
            : { concurrencia: 6, pausaMs: 0, maxReintentos: 4 }
        );

        if (cancelado) return;

        const { sortedIds: imageIds, realZStep } = ordenarCortesEspacialmente(rawImageIds);
        sliceSpacingRef.current = realZStep;

        const firstId = imageIds[0];
        const nativeMeta = csCore.metaData.get("miPacsNativeMetadata", firstId) || {};
        const patientMod = csCore.metaData.get("patientModule", firstId) || {};
        const studyMod = csCore.metaData.get("generalStudyModule", firstId) || {};
        const seriesMod = csCore.metaData.get("generalSeriesModule", firstId) || {};
        const planeMod = csCore.metaData.get("imagePlaneModule", firstId) || {};

        const estudioDesc =
          nativeMeta.studyDescription ||
          studyMod.studyDescription ||
          seriePrincipal.descripcion_estudio ||
          "N/A";

        const serieDesc =
          nativeMeta.seriesDescription ||
          seriesMod.seriesDescription ||
          seriePrincipal.descripcion ||
          seriePrincipal.series_description ||
          `Series #${idxSeguro + 1}`;

        const extractedInfo = {
          patientName: (nativeMeta.patientName || patientMod.patientName || "Unknown Patient").replace(/\^+/g, " ").trim(),
          patientId: nativeMeta.patientId || patientMod.patientId || idRealUrl || currentId || "N/A",
          patientSex: nativeMeta.patientSex || patientMod.patientSex || "",
          modality: nativeMeta.modality || seriesMod.modality || "CT",
          studyDate: formatearFechaDicom(nativeMeta.studyDate || studyMod.studyDate),
          studyDescription: estudioDesc,
          seriesDescription: serieDesc,
          totalSlices: imageIds.length,
          sliceThickness: Number((nativeMeta.sliceThickness || planeMod.sliceThickness || realZStep).toFixed(2)),
          matrix: `${nativeMeta.columns || planeMod.columns || 512}×${nativeMeta.rows || planeMod.rows || 512}`,
        };

        if (!cancelado) {
          setInfoPaciente(extractedInfo);
          setMostrarInfo(true);
        }

        const prevEngine = csCore.getRenderingEngine(renderingEngineId);
        if (prevEngine) prevEngine.destroy();

        // Liberar cualquier volumen MPR previo de la memoria GPU/RAM al cambiar de serie
        try {
          const cachedVolumes = csCore.cache.getVolumes?.() || [];
          cachedVolumes.forEach((vol) => {
            if (vol?.volumeId?.includes("my_mpr_volume_")) {
              csCore.cache.removeVolumeLoadObject(vol.volumeId);
            }
          });
        } catch (e) {}

        if (csCore.cache.getVolume(volumeId)) {
          csCore.cache.removeVolumeLoadObject(volumeId);
        }

        const renderingEngine = new csCore.RenderingEngine(renderingEngineId);

        renderingEngine.setViewports([
          {
            viewportId: "AXIAL_VIEWPORT",
            type: csCore.Enums.ViewportType.ORTHOGRAPHIC,
            element: axialRef.current,
            defaultOptions: { orientation: csCore.Enums.OrientationAxis.AXIAL, background: [0, 0, 0] },
          },
          {
            viewportId: "SAGITTAL_VIEWPORT",
            type: csCore.Enums.ViewportType.ORTHOGRAPHIC,
            element: sagittalRef.current,
            defaultOptions: { orientation: csCore.Enums.OrientationAxis.SAGITTAL, background: [0, 0, 0] },
          },
          {
            viewportId: "CORONAL_VIEWPORT",
            type: csCore.Enums.ViewportType.ORTHOGRAPHIC,
            element: coronalRef.current,
            defaultOptions: { orientation: csCore.Enums.OrientationAxis.CORONAL, background: [0, 0, 0] },
          },
        ]);

        const volume = await csCore.volumeLoader.createAndCacheVolume(volumeId, { imageIds });
        if (typeof volume.load === "function") {
          await new Promise((resolve) => {
            let finalizado = false;
            const terminar = () => {
              if (!finalizado) {
                finalizado = true;
                resolve();
              }
            };
            const timerRespaldo = setTimeout(terminar, 5000);
            try {
              const res = volume.load(() => {
                clearTimeout(timerRespaldo);
                terminar();
              });
              if (res && typeof res.then === "function") {
                res.then(() => {
                  clearTimeout(timerRespaldo);
                  terminar();
                });
              }
            } catch (e) {
              clearTimeout(timerRespaldo);
              terminar();
            }
          });
        }

        if (cancelado) return;

        await csCore.setVolumesForViewports(renderingEngine, [{ volumeId }], VIEWPORT_IDS);

        const descUpper = `${estudioDesc} ${serieDesc}`.toUpperCase();
        let initialPresetKey = "brain";
        if (descUpper.includes("HUESO") || descUpper.includes("BONE") || descUpper.includes("OSEO") || descUpper.includes("COSTAL")) {
          initialPresetKey = "bone";
        } else if (descUpper.includes("TORAX") || descUpper.includes("CHEST") || descUpper.includes("PULMON") || descUpper.includes("LUNG")) {
          initialPresetKey = "lung";
        } else if (descUpper.includes("ABDOM") || descUpper.includes("PELV") || descUpper.includes("UROTAC")) {
          initialPresetKey = "soft";
        }

        defaultPresetRef.current = initialPresetKey;
        const presetInicial = CT_PRESETS[initialPresetKey];
        ventanaRef.current = { ww: presetInicial.ww, wc: presetInicial.wc };

        if (!cancelado) {
          setPresetActivo(initialPresetKey);
          setVentanaActual({ ww: presetInicial.ww, wc: presetInicial.wc });
        }

        const lower = presetInicial.wc - presetInicial.ww / 2;
        const upper = presetInicial.wc + presetInicial.ww / 2;

        renderingEngine.resize(true);
        VIEWPORT_IDS.forEach((vpId) => {
          const vp = renderingEngine.getViewport(vpId);
          if (vp) {
            vp.resetCamera();
            if (typeof vp.setProperties === "function") {
              try {
                vp.setProperties({ voiRange: { lower, upper } });
              } catch (e) {}
            }
          }
        });

        const axialVp = renderingEngine.getViewport("AXIAL_VIEWPORT");
        const bounds = axialVp?.getDefaultActor?.()?.actor?.getBounds?.();
        if (Array.isArray(bounds) && bounds.length === 6) {
          volumeBoundsRef.current = bounds;
        }

        renderingEngine.renderViewports(VIEWPORT_IDS);

        // 🛡️ ESCUDO DE MEMORIA: Liberar cortes 2D individuales solo DESPUÉS de renderizar el volumen 3D en GPU
        setTimeout(() => {
          if (cancelado) return;
          imageIds.forEach((imgId) => {
            try {
              if (csCore.cache && typeof csCore.cache.removeImageLoadObject === "function") {
                csCore.cache.removeImageLoadObject(imgId);
              }
            } catch (e) {}
          });
        }, 400);

        if (!cancelado) {
          const activeLangEn = (localStorage.getItem("i18nextLng") || i18n.language || "").toLowerCase().startsWith("en");
          setOrientaciones({
            AXIAL_VIEWPORT: calcularMarcadoresViewport(renderingEngine.getViewport("AXIAL_VIEWPORT"), activeLangEn),
            CORONAL_VIEWPORT: calcularMarcadoresViewport(renderingEngine.getViewport("CORONAL_VIEWPORT"), activeLangEn),
            SAGITTAL_VIEWPORT: calcularMarcadoresViewport(renderingEngine.getViewport("SAGITTAL_VIEWPORT"), activeLangEn),
          });
        }

        try {
          vincularHerramientasMPR(renderingEngineId, toolGroupId, toolModeRef.current);
        } catch (e) {
          console.warn("Aviso configurando herramientas MPR:", e);
        }

        if (!cancelado) setCargando(false);
      } catch (error) {
        console.error("❌ Error inicializando MPR:", error);
        if (!cancelado) {
          const msg =
            error?.message ||
            error?.error?.statusText ||
            (enIngles ? "Error building 3D volume" : "Error construyendo volumen 3D");
          setErrorMsg(msg);
          setCargando(false);
        }
      }
    };

    inicializarMPR();

    return () => {
      cancelado = true;
      wheelHandlers.forEach(({ el, fn }) => {
        if (el) el.removeEventListener("wheel", fn, { capture: true });
      });
      const engine = csCore.getRenderingEngine(renderingEngineId);
      if (engine) engine.destroy();
      const tg = csTools.ToolGroupManager.getToolGroup(toolGroupId);
      if (tg) csTools.ToolGroupManager.destroyToolGroup(toolGroupId);
      csCore.cache.purgeCache();
    };
  }, [currentId, idRealUrl, activeToken, isGuest, serieIdx, i18n.language]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#fbbf24", fontSize: "15px" }}>
            {isEn
              ? "🧊 MI_PACS - 3D Multiplanar Reconstruction (MPR)"
              : "🧊 MI_PACS - Reconstrucción Multiplanar (MPR) 3D"}
          </h3>

          {seriesDisponibles.length > 1 && (
            <select
              value={serieIdx}
              onChange={(e) => setSerieIdx(Number(e.target.value))}
              style={styles.seriesSelect}
              title={isEn ? "Select Volumetric Series" : "Seleccionar Serie Volumétrica"}
            >
              {seriesDisponibles.map((s, idx) => {
                const desc = s.descripcion || s.series_description || (isEn ? `Series #${idx + 1}` : `Serie #${idx + 1}`);
                return (
                  <option key={idx} value={idx}>
                    {desc} ({s.imagenes?.length || 0} img)
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div style={{ display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={styles.modeGroup}>
            <button
              onClick={() => cambiarModoHerramienta("crosshairs")}
              style={{
                ...styles.btnMode,
                backgroundColor: toolMode === "crosshairs" ? "#10b981" : "transparent",
                color: toolMode === "crosshairs" ? "#0f172a" : "#e2e8f0",
              }}
              title={isEn ? "Left Drag: Move 3D Crosshairs" : "Clic Izq: Mover Ejes 3D"}
            >
              {isEn ? "✚ Crosshairs" : "✚ Ejes 3D"}
            </button>
            <button
              onClick={() => cambiarModoHerramienta("wl")}
              style={{
                ...styles.btnMode,
                backgroundColor: toolMode === "wl" ? "#38bdf8" : "transparent",
                color: toolMode === "wl" ? "#0f172a" : "#e2e8f0",
              }}
              title={isEn ? "Left Drag: Dynamic Brightness/Contrast" : "Clic Izq: Ajustar Brillo/Contraste"}
            >
              {isEn ? "☀ W/L (Contrast)" : "☀ Brillo/Contraste"}
            </button>
          </div>

          {Object.entries(CT_PRESETS).map(([key, item]) => (
            <button
              key={key}
              onClick={() => aplicarVentanaCT(key)}
              style={{
                ...styles.btnPreset,
                backgroundColor: presetActivo === key ? "#0284c7" : "#1e293b",
                borderColor: presetActivo === key ? "#38bdf8" : "#334155",
              }}
            >
              {isEn ? item.labelEn : item.labelEs}
            </button>
          ))}

          <div style={styles.wlBadge} title={isEn ? "Window Width / Window Center" : "Ancho de Ventana / Nivel de Ventana"}>
            WW: <strong style={{ color: "#38bdf8" }}>{ventanaActual.ww}</strong> | WC:{" "}
            <strong style={{ color: "#38bdf8" }}>{ventanaActual.wc}</strong>
          </div>

          <div style={styles.speedGroup}>
            <span style={{ color: "#94a3b8", fontSize: "11px", padding: "0 6px" }}>
              {isEn ? "Scroll:" : "Rueda:"}
            </span>
            {[1, 2, 4].map((mult) => (
              <button
                key={mult}
                onClick={() => cambiarVelocidad(mult)}
                style={{
                  ...styles.btnSpeed,
                  backgroundColor: velocidadRueda === mult ? "#10b981" : "transparent",
                  color: velocidadRueda === mult ? "#0f172a" : "#e2e8f0",
                }}
              >
                {mult}x
              </button>
            ))}
          </div>

          <button style={styles.btnReset} onClick={reiniciarVista}>
            {isEn ? "↺ Reset View" : "↺ Reiniciar Vista"}
          </button>

          <button
            onClick={() => setMostrarInfo((prev) => !prev)}
            style={{
              ...styles.btnInfo,
              backgroundColor: mostrarInfo ? "#0891b2" : "#1e293b",
              borderColor: mostrarInfo ? "#22d3ee" : "#334155",
            }}
            title={isEn ? "Show/Hide Patient Metadata" : "Mostrar/Ocultar Información del Paciente"}
          >
            ℹ Info
          </button>

          <button style={styles.btnCerrar} onClick={() => window.close()}>
            {isEn ? "Close MPR" : "Cerrar MPR"}
          </button>
        </div>
      </div>

      {cargando && (
        <div style={styles.loadingOverlay}>
          <h2>
            {isEn
              ? "Reconstructing 3D Volume on GPU..."
              : "Reconstruyendo Volumen 3D en la GPU..."}
          </h2>
          <p>
            {progresoCarga.total > 0
              ? isEn
                ? `Loading slices safely: ${progresoCarga.actual} / ${progresoCarga.total}`
                : `Cargando cortes de forma segura: ${progresoCarga.actual} / ${progresoCarga.total}`
              : isEn
                ? "Preparing volumetric series..."
                : "Preparando serie volumétrica..."}
          </p>
        </div>
      )}

      {!cargando && errorMsg && (
        <div style={styles.loadingOverlay}>
          <h3 style={{ color: "#f87171" }}>⚠️ {errorMsg}</h3>
        </div>
      )}

      <div style={styles.gridContainer}>
        <div style={styles.viewportWrapper}>
          <div style={styles.label}>AXIAL</div>
          <OrientationOverlay markers={orientaciones.AXIAL_VIEWPORT} />
          <div
            ref={axialRef}
            style={{ ...styles.viewport, cursor: toolMode === "wl" ? "ns-resize" : "crosshair" }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div style={styles.viewportWrapper}>
          <div style={styles.label}>CORONAL</div>
          <OrientationOverlay markers={orientaciones.CORONAL_VIEWPORT} />
          <div
            ref={coronalRef}
            style={{ ...styles.viewport, cursor: toolMode === "wl" ? "ns-resize" : "crosshair" }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div style={styles.viewportWrapper}>
          <div style={styles.label}>{isEn ? "SAGITTAL" : "SAGITAL"}</div>
          <OrientationOverlay markers={orientaciones.SAGITTAL_VIEWPORT} />
          <div
            ref={sagittalRef}
            style={{ ...styles.viewport, cursor: toolMode === "wl" ? "ns-resize" : "crosshair" }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div style={styles.infoQuadrant}>
          {!cargando && mostrarInfo && infoPaciente && (
            <div style={styles.metadataCard}>
              <div style={styles.metadataHeader}>
                <span>
                  {isEn ? "NATIVE FILE METADATA" : "METADATOS NATIVOS DEL ESTUDIO"}
                </span>
                <button
                  onClick={() => setMostrarInfo(false)}
                  style={styles.metadataCloseBtn}
                  title={isEn ? "Hide" : "Ocultar"}
                >
                  ✕
                </button>
              </div>

              <div style={styles.metadataBody}>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Patient:" : "Paciente:"}</span>
                  <span style={styles.metaValStrong}>{infoPaciente.patientName}</span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Original ID:" : "ID Paciente:"}</span>
                  <span style={styles.metaVal}>
                    {infoPaciente.patientId}
                    {infoPaciente.patientSex ? `  •  ${infoPaciente.patientSex}` : ""}
                  </span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Modality:" : "Modalidad:"}</span>
                  <span style={styles.metaBadge}>{infoPaciente.modality}</span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Study Date:" : "Fecha Estudio:"}</span>
                  <span style={styles.metaVal}>{infoPaciente.studyDate}</span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Study:" : "Estudio:"}</span>
                  <span style={styles.metaVal}>{infoPaciente.studyDescription}</span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Series (Slices):" : "Serie (Cortes):"}</span>
                  <span style={styles.metaVal}>
                    {infoPaciente.seriesDescription} ({infoPaciente.totalSlices} img)
                  </span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "3D Geometry:" : "Geometría 3D:"}</span>
                  <span style={styles.metaVal}>
                    {infoPaciente.matrix} px  •  {infoPaciente.sliceThickness} mm
                  </span>
                </div>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>{isEn ? "Window (WW/WC):" : "Ventana (WW/WC):"}</span>
                  <span style={styles.metaVal}>
                    {ventanaActual.ww} / {ventanaActual.wc} HU
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.footerBar}>
        {toolMode === "wl"
          ? isEn
            ? "Controls: Wheel = Scroll Slices | Left Drag = Brightness/Contrast (WW/WC) | Right Drag = Zoom | Middle Drag = Pan"
            : "Controles: Rueda = Cambiar Cortes | Clic Izq = Brillo/Contraste (WW/WC) | Clic Der = Zoom | Clic Central = Mover"
          : isEn
            ? "Controls: Wheel = Scroll Slices | Left Drag = Sync Crosshairs (Shift+Drag = W/L) | Right Drag = Zoom | Middle Drag = Pan"
            : "Controles: Rueda = Cambiar Cortes | Clic Izq = Sincronizar Ejes (Shift+Arrastrar = Brillo/Contraste) | Clic Der = Zoom | Clic Central = Mover"}
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "#000", fontFamily: "system-ui, sans-serif", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", backgroundColor: "#111418", borderBottom: "1px solid #1e293b", flexShrink: 0, gap: "10px", flexWrap: "wrap" },
  seriesSelect: { backgroundColor: "#1e293b", color: "#38bdf8", border: "1px solid #38bdf8", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", maxWidth: "240px" },
  modeGroup: { display: "flex", alignItems: "center", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "4px", padding: "2px", gap: "2px" },
  btnMode: { border: "none", padding: "5px 10px", borderRadius: "3px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  btnPreset: { color: "#e2e8f0", border: "1px solid #334155", padding: "5px 9px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "600" },
  wlBadge: { backgroundColor: "#0f172a", border: "1px solid #334155", color: "#cbd5e1", padding: "5px 9px", borderRadius: "4px", fontSize: "11.5px", fontFamily: "monospace" },
  speedGroup: { display: "flex", alignItems: "center", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "4px", padding: "2px" },
  btnSpeed: { border: "none", padding: "4px 7px", borderRadius: "3px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" },
  btnReset: { backgroundColor: "#f59e0b", color: "#0f172a", border: "none", padding: "6px 11px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  btnInfo: { color: "#ffffff", border: "1px solid #22d3ee", padding: "5px 11px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  btnCerrar: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "6px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" },
  gridContainer: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "2px", padding: "2px" },
  viewportWrapper: { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", backgroundColor: "#000000", border: "1px solid #1e293b" },
  viewport: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, outline: "none" },
  label: { position: "absolute", top: "10px", left: "10px", color: "#fbbf24", zIndex: 10, fontSize: "12px", fontWeight: "bold", textShadow: "1px 1px 2px #000", pointerEvents: "none" },
  orientBadge: { position: "absolute", zIndex: 12, color: "#38bdf8", backgroundColor: "rgba(0, 0, 0, 0.55)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: "3px", padding: "1px 6px", fontSize: "12px", fontWeight: "bold", textShadow: "1px 1px 2px #000", pointerEvents: "auto", userSelect: "none" },
  infoQuadrant: { position: "relative", minWidth: 0, minHeight: 0, backgroundColor: "#000000", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  metadataCard: { width: "100%", maxWidth: "490px", backgroundColor: "rgba(15, 23, 42, 0.94)", border: "1px solid #334155", borderLeft: "3px solid #fbbf24", borderRadius: "6px", padding: "18px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.65)" },
  metadataHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fbbf24", fontSize: "11px", fontWeight: "bold", letterSpacing: "0.06em", borderBottom: "1px solid #1e293b", paddingBottom: "8px", marginBottom: "10px" },
  metadataCloseBtn: { background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px", padding: "0 4px" },
  metadataBody: { display: "flex", flexDirection: "column", gap: "6px" },
  metaRow: { display: "flex", gap: "8px", fontSize: "12.5px", lineHeight: "1.35" },
  metaKey: { color: "#94a3b8", minWidth: "115px", flexShrink: 0 },
  metaVal: { color: "#e2e8f0", wordBreak: "break-word" },
  metaValStrong: { color: "#ffffff", fontWeight: "bold", wordBreak: "break-word" },
  metaBadge: { backgroundColor: "#0284c7", color: "#fff", padding: "1px 7px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" },
  footerBar: { padding: "5px 20px", backgroundColor: "#0f172a", borderTop: "1px solid #1e293b", color: "#94a3b8", fontSize: "12px", textAlign: "center", flexShrink: 0 },
  loadingOverlay: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#38bdf8" }
};