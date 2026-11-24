import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  cache,
  metaData,
  getRenderingEngine,
} from '@cornerstonejs/core';
import {
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollMouseWheelTool,
  CrosshairsTool,
  Enums as csToolsEnums,
  addTool,
} from '@cornerstonejs/tools';
import * as cornerstoneInitModule from '../cornerstoneInit';

const RENDERING_ENGINE_ID = 'miPacsMpr3dEngine';
const TOOL_GROUP_ID = 'miPacsMpr3dToolGroup';

const VIEWPORT_IDS = {
  AXIAL: 'MPR_AXIAL',
  CORONAL: 'MPR_CORONAL',
  SAGITTAL: 'MPR_SAGITTAL',
};

const PRESETS_WL = [
  { key: 'soft', labelEn: 'Soft Tissue', labelEs: 'Tejido Blando', ww: 400, wc: 40 },
  { key: 'bone', labelEn: 'Bone', labelEs: 'Hueso', ww: 2000, wc: 500 },
  { key: 'lung', labelEn: 'Lung', labelEs: 'Pulmón', ww: 1500, wc: -600 },
  { key: 'brain', labelEn: 'Brain', labelEs: 'Cerebro', ww: 80, wc: 40 },
];

export default function VisorMPR3D() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const isEs = (i18n?.language || localStorage.getItem('i18nextLng') || 'en')
    .toLowerCase()
    .startsWith('es');

  const axialRef = useRef(null);
  const coronalRef = useRef(null);
  const sagittalRef = useRef(null);
  const activeVolumeIdRef = useRef(null);

  const [estudio, setEstudio] = useState(null);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesIdx, setSelectedSeriesIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [wlModeActive, setWlModeActive] = useState(false);
  const [wlValues, setWlValues] = useState({ ww: 400, wc: 40 });
  const [activePreset, setActivePreset] = useState('soft');
  const [showInfoCard, setShowInfoCard] = useState(true);
  const [volumeStats, setVolumeStats] = useState({
    dims: '512 × 512',
    spacing: '1 mm',
    seriesDesc: '',
  });

  // Detecta si la conexión es LAN directa o túnel público (Cloudflare)
  const isLocalNetwork = useCallback(() => {
    const host = window.location.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  }, []);

  // Purga segura de memoria GPU/RAM de volúmenes previos
  const cleanupPreviousVolume = useCallback(() => {
    if (activeVolumeIdRef.current) {
      try {
        cache.removeVolumeLoadObject(activeVolumeIdRef.current);
      } catch (_) {
        // Ignorar si ya fue liberado
      }
      activeVolumeIdRef.current = null;
    }
  }, []);

  // Carga inicial de metadatos del estudio y agrupación por series
  useEffect(() => {
    let cancelled = false;
    async function fetchStudyMetadata() {
      try {
        setLoading(true);
        setErrorMsg('');
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`/api/estudios/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setEstudio(data);

        const rawImages = data.imagenes || data.images || data.slices || [];
        if (!rawImages.length) {
          throw new Error(
            isEs
              ? 'El estudio no contiene imágenes DICOM disponibles.'
              : 'No DICOM images available for this study.'
          );
        }

        // Agrupar imágenes por Serie (SeriesInstanceUID o series_number)
        const groupsMap = new Map();
        rawImages.forEach((img, index) => {
          const uid =
            img.series_instance_uid ||
            img.series_uid ||
            `SERIE_${img.series_number ?? 1}`;
          if (!groupsMap.has(uid)) {
            groupsMap.set(uid, {
              uid,
              seriesNumber: img.series_number ?? groupsMap.size + 1,
              description:
                img.series_description ||
                img.descripcion ||
                `Series #${img.series_number ?? groupsMap.size + 1}`,
              images: [],
            });
          }
          groupsMap.get(uid).images.push({ ...img, _origIdx: index });
        });

        const grouped = Array.from(groupsMap.values()).map((s) => {
          // Ordenar cortes por InstanceNumber o SliceLocation para coherencia anatómica
          s.images.sort((a, b) => {
            const locA = parseFloat(a.slice_location ?? a.posicion_z);
            const locB = parseFloat(b.slice_location ?? b.posicion_z);
            if (!Number.isNaN(locA) && !Number.isNaN(locB) && locA !== locB) {
              return locA - locB;
            }
            const instA = parseInt(a.instance_number ?? a.numero_imagen ?? a._origIdx, 10);
            const instB = parseInt(b.instance_number ?? b.numero_imagen ?? b._origIdx, 10);
            return instA - instB;
          });
          return s;
        });

        // Seleccionar por defecto la serie volumétrica con mayor cantidad de cortes
        let bestIdx = 0;
        grouped.forEach((s, idx) => {
          if (s.images.length > grouped[bestIdx].images.length) {
            bestIdx = idx;
          }
        });

        setSeriesList(grouped);
        setSelectedSeriesIdx(bestIdx);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            isEs
              ? `Error cargando metadatos del estudio: ${err.message}`
              : `Error loading study metadata: ${err.message}`
          );
          setLoading(false);
        }
      }
    }

    fetchStudyMetadata();
    return () => {
      cancelled = true;
    };
  }, [id, isEs]);

  // Construcción y renderizado del volumen 3D con escudo de memoria
  useEffect(() => {
    if (!seriesList.length || !seriesList[selectedSeriesIdx]) return;
    let cancelled = false;

    async function buildVolumeAndViewports() {
      try {
        setLoading(true);
        setErrorMsg('');

        // Inicializar Cornerstone3D y decodificador en memoria
        if (typeof cornerstoneInitModule.initCornerstone === 'function') {
          await cornerstoneInitModule.initCornerstone();
        } else if (typeof cornerstoneInitModule.default === 'function') {
          await cornerstoneInitModule.default();
        }

        const currentSeries = seriesList[selectedSeriesIdx];
        const slices = currentSeries.images;
        if (slices.length < 3) {
          throw new Error(
            isEs
              ? 'Se requieren al menos 3 cortes contiguos para reconstrucción MPR 3D.'
              : 'At least 3 contiguous slices are required for 3D MPR reconstruction.'
          );
        }

        // Liberar volumen anterior antes de asignar nueva memoria GPU
        cleanupPreviousVolume();

        const origin = window.location.origin;
        const imageIds = slices.map((img) => {
          const streamPath = img.stream_url || `/api/dicom/stream/${img.id}`;
          const fullUrl = streamPath.startsWith('http')
            ? streamPath
            : `${origin}${streamPath}`;
          return `wadouri:${fullUrl}`;
        });

        setProgress({ loaded: 0, total: imageIds.length });

        // Descarga adaptativa por lotes (protege túnel Cloudflare y estudios de 1,000+ cortes)
        const lan = isLocalNetwork();
        const isMassive = imageIds.length >= 800;
        const batchSize = lan ? (isMassive ? 6 : 8) : 3;
        const batchDelayMs = lan ? (isMassive ? 15 : 0) : isMassive ? 80 : 60;

        const { imageLoader } = await import('@cornerstonejs/core');

        const loadWithRetry = async (imageId, retries = 3) => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              await imageLoader.loadAndCacheImage(imageId);
              return;
            } catch (err) {
              if (attempt === retries) throw err;
              await new Promise((r) => setTimeout(r, 250 * attempt));
            }
          }
        };

        let completed = 0;
        for (let i = 0; i < imageIds.length; i += batchSize) {
          if (cancelled) return;
          const batch = imageIds.slice(i, i + batchSize);
          await Promise.all(batch.map((imgId) => loadWithRetry(imgId)));
          completed += batch.length;
          if (!cancelled) {
            setProgress({ loaded: Math.min(completed, imageIds.length), total: imageIds.length });
          }
          if (batchDelayMs > 0 && i + batchSize < imageIds.length) {
            await new Promise((r) => setTimeout(r, batchDelayMs));
          }
        }

        if (cancelled) return;

        // Configurar RenderingEngine
        let renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
        if (renderingEngine) {
          renderingEngine.destroy();
        }
        renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);

        const viewportInputArray = [
          {
            viewportId: VIEWPORT_IDS.AXIAL,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: axialRef.current,
            defaultOptions: {
              orientation: Enums.OrientationAxis.AXIAL,
              background: [0, 0, 0],
            },
          },
          {
            viewportId: VIEWPORT_IDS.CORONAL,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: coronalRef.current,
            defaultOptions: {
              orientation: Enums.OrientationAxis.CORONAL,
              background: [0, 0, 0],
            },
          },
          {
            viewportId: VIEWPORT_IDS.SAGITTAL,
            type: Enums.ViewportType.ORTHOGRAPHIC,
            element: sagittalRef.current,
            defaultOptions: {
              orientation: Enums.OrientationAxis.SAGITTAL,
              background: [0, 0, 0],
            },
          },
        ];

        renderingEngine.setViewports(viewportInputArray);

        // Ensamblar el volumen 3D en la GPU
        const volumeId = `cornerstoneStreamingImageVolume:MPR_${id}_S${selectedSeriesIdx}_${Date.now()}`;
        activeVolumeIdRef.current = volumeId;

        const volume = await volumeLoader.createAndCacheVolume(volumeId, {
          imageIds,
        });

        await volume.load();
        if (cancelled) return;

        // Extraer dimensiones reales del volumen para la tarjeta de metadatos
        const dims = volume.dimensions || [512, 512, imageIds.length];
        const spacing = volume.spacing || [1, 1, 1];
        setVolumeStats({
          dims: `${dims[0]}×${dims[1]} px`,
          spacing: `${Number(spacing[2] || 1).toFixed(2).replace(/\.00$/, '')} mm`,
          seriesDesc: currentSeries.description,
        });

        // 🛡️ ESCUDO DE MEMORIA: Una vez subido el volumen 3D a la GPU, liberar los cortes 2D individuales de la RAM
        imageIds.forEach((imgId) => {
          try {
            cache.removeImageLoadObject(imgId);
          } catch (_) {
            // Ignorar entradas ya limpiadas
          }
        });

        await setVolumesForViewports(
          renderingEngine,
          [{ volumeId }],
          [VIEWPORT_IDS.AXIAL, VIEWPORT_IDS.CORONAL, VIEWPORT_IDS.SAGITTAL]
        );

        // Registrar y configurar herramientas interactivas
        [
          WindowLevelTool,
          PanTool,
          ZoomTool,
          StackScrollMouseWheelTool,
          CrosshairsTool,
        ].forEach((tool) => {
          try {
            addTool(tool);
          } catch (_) {
            // Ya registrada
          }
        });

        let toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
        if (toolGroup) {
          ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
        }
        toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);

        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(StackScrollMouseWheelTool.toolName);
        toolGroup.addTool(CrosshairsTool.toolName, {
          getReferenceLineColor: (viewportId) => {
            if (viewportId === VIEWPORT_IDS.AXIAL) return [56, 189, 248];
            if (viewportId === VIEWPORT_IDS.CORONAL) return [34, 197, 94];
            return [250, 204, 21];
          },
        });

        toolGroup.addViewport(VIEWPORT_IDS.AXIAL, RENDERING_ENGINE_ID);
        toolGroup.addViewport(VIEWPORT_IDS.CORONAL, RENDERING_ENGINE_ID);
        toolGroup.addViewport(VIEWPORT_IDS.SAGITTAL, RENDERING_ENGINE_ID);

        // Configuración inicial: Ejes 3D en clic izquierdo, Paneo en central, Zoom en derecho, Rueda para cortes
        toolGroup.setToolActive(CrosshairsTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        });
        toolGroup.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
        });
        toolGroup.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
        });
        toolGroup.setToolActive(StackScrollMouseWheelTool.toolName);
        toolGroup.setToolPassive(WindowLevelTool.toolName);

        // Aplicar ventana inicial según modalidad (Cerebro/Tejido blando)
        const isBrain = /brain|cerebro|craneo|head/i.test(
          `${estudio?.descripcion || ''} ${currentSeries.description}`
        );
        const initialPreset = isBrain
          ? PRESETS_WL.find((p) => p.key === 'brain')
          : PRESETS_WL[0];
        applyWindowLevel(initialPreset.ww, initialPreset.wc, initialPreset.key);

        renderingEngine.renderViewports([
          VIEWPORT_IDS.AXIAL,
          VIEWPORT_IDS.CORONAL,
          VIEWPORT_IDS.SAGITTAL,
        ]);

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            isEs
              ? `Error reconstruyendo volumen 3D: ${err.message}`
              : `Error building 3D volume: ${err.message}`
          );
          setLoading(false);
        }
      }
    }

    buildVolumeAndViewports();

    return () => {
      cancelled = true;
    };
  }, [seriesList, selectedSeriesIdx, id, isLocalNetwork, cleanupPreviousVolume, isEs, estudio]);

  // Limpieza total al desmontar el componente
  useEffect(() => {
    return () => {
      try {
        ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
      } catch (_) {}
      try {
        const engine = getRenderingEngine(RENDERING_ENGINE_ID);
        if (engine) engine.destroy();
      } catch (_) {}
      cleanupPreviousVolume();
    };
  }, [cleanupPreviousVolume]);

  // Escuchar cambios en tiempo real de Brillo/Contraste (WW/WC)
  useEffect(() => {
    const elements = [axialRef.current, coronalRef.current, sagittalRef.current].filter(Boolean);
    const handleVoiModified = (evt) => {
      const range = evt.detail?.range;
      if (range && typeof range.lower === 'number' && typeof range.upper === 'number') {
        const ww = Math.round(range.upper - range.lower);
        const wc = Math.round((range.upper + range.lower) / 2);
        setWlValues({ ww, wc });
        setActivePreset('custom');
      }
    };

    elements.forEach((el) =>
      el.addEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified)
    );
    return () => {
      elements.forEach((el) =>
        el.removeEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified)
      );
    };
  }, [loading]);

  const applyWindowLevel = (ww, wc, presetKey = 'custom') => {
    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) return;

    const lower = wc - ww / 2;
    const upper = wc + ww / 2;

    Object.values(VIEWPORT_IDS).forEach((vpId) => {
      const vp = renderingEngine.getViewport(vpId);
      if (vp) {
        vp.setProperties({ voiRange: { lower, upper } });
        vp.render();
      }
    });

    setWlValues({ ww: Math.round(ww), wc: Math.round(wc) });
    setActivePreset(presetKey);
  };

  const toggleWlMouseMode = () => {
    const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
    if (!toolGroup) return;

    const nextMode = !wlModeActive;
    if (nextMode) {
      toolGroup.setToolPassive(CrosshairsTool.toolName);
      toolGroup.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
    } else {
      toolGroup.setToolPassive(WindowLevelTool.toolName);
      toolGroup.setToolActive(CrosshairsTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
    }
    setWlModeActive(nextMode);
  };

  const handleResetView = () => {
    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) return;

    Object.values(VIEWPORT_IDS).forEach((vpId) => {
      const vp = renderingEngine.getViewport(vpId);
      if (vp) {
        vp.resetCamera();
        vp.render();
      }
    });
  };

  const handleClose = () => {
    const returnTo = searchParams.get('from');
    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(-1);
    }
  };

  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-slate-100 select-none">
      {/* BARRA SUPERIOR DE HERRAMIENTAS */}
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#0b1120] border-b border-slate-800 px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sky-400 tracking-wide">
            🧊 MI_PACS —{' '}
            {isEs
              ? 'Reconstrucción Multiplanar 3D (MPR)'
              : '3D Multiplanar Reconstruction (MPR)'}
          </span>

          {seriesList.length > 0 && (
            <select
              value={selectedSeriesIdx}
              onChange={(e) => setSelectedSeriesIdx(Number(e.target.value))}
              disabled={loading}
              className="bg-slate-900 border border-sky-500/50 text-sky-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-sky-400"
            >
              {seriesList.map((s, idx) => (
                <option key={s.uid} value={idx}>
                  {isEs ? `Serie #${s.seriesNumber}` : `Series #${s.seriesNumber}`} (
                  {s.images.length} img)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Modo Ejes 3D vs Brillo/Contraste continuo */}
          <button
            onClick={() => wlModeActive && toggleWlMouseMode()}
            className={`px-2.5 py-1 rounded font-medium transition ${
              !wlModeActive
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ✚ {isEs ? 'Ejes 3D' : 'Crosshairs'}
          </button>

          <button
            onClick={toggleWlMouseMode}
            className={`px-2.5 py-1 rounded font-medium transition ${
              wlModeActive
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ☀ {isEs ? 'W/L (Contraste)' : 'W/L (Contrast)'}
          </button>

          {/* Presets Anatómicos */}
          <div className="hidden md:flex items-center gap-1 mx-1">
            {PRESETS_WL.map((p) => (
              <button
                key={p.key}
                onClick={() => applyWindowLevel(p.ww, p.wc, p.key)}
                className={`px-2 py-1 rounded transition ${
                  activePreset === p.key
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isEs ? p.labelEs : p.labelEn}
              </button>
            ))}
          </div>

          {/* Lectura en vivo WW / WC */}
          <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-sky-300">
            WW: {wlValues.ww} | WC: {wlValues.wc}
          </span>

          <button
            onClick={handleResetView}
            className="px-2.5 py-1 rounded bg-amber-600/90 hover:bg-amber-500 text-white font-medium transition"
          >
            ↺ {isEs ? 'Restaurar' : 'Reset View'}
          </button>

          <button
            onClick={() => setShowInfoCard((prev) => !prev)}
            className={`px-2.5 py-1 rounded font-medium transition ${
              showInfoCard
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ℹ Info
          </button>

          <button
            onClick={handleClose}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
          >
            ✕ {isEs ? 'Cerrar MPR' : 'Close MPR'}
          </button>
        </div>
      </header>

      {/* CUADRÍCULA ORTOGONAL 2x2 */}
      <main className="relative flex-1 grid grid-cols-2 grid-rows-2 bg-black overflow-hidden">
        {/* CUADRANTE SUPERIOR IZQUIERDO: AXIAL */}
        <div className="relative border-r border-b border-slate-800">
          <span className="absolute top-2 left-2 z-10 text-[11px] font-bold tracking-wider text-amber-400 pointer-events-none">
            AXIAL
          </span>
          <span className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            A
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            P
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            R
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            L
          </span>
          <div
            ref={axialRef}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full"
          />
        </div>

        {/* CUADRANTE SUPERIOR DERECHO: CORONAL */}
        <div className="relative border-b border-slate-800">
          <span className="absolute top-2 left-2 z-10 text-[11px] font-bold tracking-wider text-amber-400 pointer-events-none">
            CORONAL
          </span>
          <span className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            S
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            I
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            R
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            L
          </span>
          <div
            ref={coronalRef}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full"
          />
        </div>

        {/* CUADRANTE INFERIOR IZQUIERDO: SAGITAL */}
        <div className="relative border-r border-slate-800">
          <span className="absolute top-2 left-2 z-10 text-[11px] font-bold tracking-wider text-amber-400 pointer-events-none">
            {isEs ? 'SAGITAL' : 'SAGITTAL'}
          </span>
          <span className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            S
          </span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            I
          </span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            A
          </span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-[10px] font-bold text-sky-400 pointer-events-none">
            P
          </span>
          <div
            ref={sagittalRef}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full"
          />
        </div>

        {/* CUADRANTE INFERIOR DERECHO: TARJETA DE METADATOS */}
        <div className="relative flex items-center justify-center bg-[#030712] p-4">
          {showInfoCard && estudio && (
            <div className="w-full max-w-md rounded-lg border border-slate-700/80 bg-[#0b1120]/95 p-4 shadow-xl text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="font-bold tracking-wider text-amber-400 uppercase">
                  {isEs ? 'METADATOS NATIVOS DEL ESTUDIO' : 'NATIVE FILE METADATA'}
                </span>
                <button
                  onClick={() => setShowInfoCard(false)}
                  className="text-slate-400 hover:text-white px-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[11px]">
                <span className="text-slate-400">{isEs ? 'Paciente:' : 'Patient:'}</span>
                <span className="font-semibold text-white truncate">
                  {estudio.paciente_nombre || estudio.patient_name || 'N/A'}
                </span>

                <span className="text-slate-400">{isEs ? 'ID Clínico:' : 'Clinical ID:'}</span>
                <span className="text-slate-200">
                  {estudio.paciente_identificacion || estudio.patient_id || id}
                </span>

                <span className="text-slate-400">{isEs ? 'Modalidad:' : 'Modality:'}</span>
                <span>
                  <span className="inline-block rounded bg-sky-600/30 border border-sky-500/50 px-1.5 py-0.5 font-bold text-sky-300">
                    {estudio.modalidad || 'CT'}
                  </span>
                </span>

                <span className="text-slate-400">{isEs ? 'Fecha Estudio:' : 'Study Date:'}</span>
                <span className="text-slate-200">
                  {estudio.fecha_estudio || estudio.study_date || 'N/A'}
                </span>

                <span className="text-slate-400">{isEs ? 'Estudio:' : 'Study:'}</span>
                <span className="text-slate-200 truncate">
                  {estudio.descripcion || estudio.study_description || 'N/A'}
                </span>

                <span className="text-slate-400">{isEs ? 'Serie (Cortes):' : 'Series (Slices):'}</span>
                <span className="text-slate-200 truncate">
                  {volumeStats.seriesDesc} ({progress.total} img)
                </span>

                <span className="text-slate-400">{isEs ? 'Geometría 3D:' : '3D Geometry:'}</span>
                <span className="text-slate-200">
                  {volumeStats.dims} • {volumeStats.spacing}
                </span>

                <span className="text-slate-400">
                  {isEs ? 'Ventana (WW/WC):' : 'Window (WW/WC):'}
                </span>
                <span className="font-mono text-sky-300">
                  {wlValues.ww} / {wlValues.wc} HU
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SUPERPOSICIÓN DE PROGRESO / ERROR */}
        {(loading || errorMsg) && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-6">
            {errorMsg ? (
              <div className="max-w-md rounded-lg border border-rose-500/50 bg-rose-950/80 p-5 text-center">
                <p className="text-sm font-semibold text-rose-200 mb-4">{errorMsg}</p>
                <button
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  {isEs ? 'Volver al visor' : 'Back to viewer'}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/95 p-6 text-center shadow-2xl">
                <p className="text-sm font-semibold text-sky-400 mb-2">
                  {isEs
                    ? 'Construyendo Volumen 3D en GPU...'
                    : 'Building 3D Volume on GPU...'}
                </p>
                <p className="text-xs text-slate-300 mb-3 font-mono">
                  {progress.loaded} / {progress.total}{' '}
                  {isEs ? 'cortes' : 'slices'} ({pct}%)
                </p>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}