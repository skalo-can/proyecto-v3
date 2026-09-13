/**
 * VisorDICOMWrapper.jsx — MI_PACS
 * ---------------------------------------------------------
 * Visor clínico de producción con herramientas premium inyectadas.
 * ✔ Layout Grid dinámico (hasta 16 pantallas).
 * ✔ Panel de Dictado inferior acoplado.
 * ✔ Herramienta de Lupa (MagnifyTool) y Selector de Presets Clínicos.
 * ✔ Barra de herramientas en dos líneas (Workflow y Tools).
 * ✔ CORRECCIÓN: Distribución absoluta de series (1 al N) al abrir cuadrículas.
 * ✔ CORRECCIÓN: El botón 1x1 "atrapa" la imagen activa seleccionada por el médico.
 */

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

import CompareViewer from "./components/DicomViewer/CompareViewer";
import ModalDictadoHardware from "./pages/ModalDictadoHardware"; 

import cornerstone from "cornerstone-core";
import cornerstoneTools from "cornerstone-tools";
import cornerstoneMath from "cornerstone-math";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import dicomParser from "dicom-parser";
import Hammer from "hammerjs";

cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

cornerstoneWADOImageLoader.webWorkerManager.initialize({
  maxWebWorkers: navigator.hardwareConcurrency || 1,
  startWebWorkersOnDemand: true,
  taskConfiguration: { decodeTask: { initializeCodecsOnStartup: false, strict: false } }
});

cornerstoneTools.init({ globalToolSyncEnabled: true, showSVGCursors: true });
cornerstoneTools.textStyle.setFont('16px Arial, Helvetica, sans-serif');
cornerstoneTools.toolColors.setToolColor('#ffcc00'); 
cornerstoneTools.toolColors.setActiveColor('#00ff00'); 
cornerstoneTools.toolStyle.setToolWidth(2);

const API_BASE = window.location.origin;

const SerieThumbnail = ({ url }) => {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || !url) return;
    const element = elementRef.current;
    
    const tryLoad = () => {
      try { cornerstone.getEnabledElement(element); } 
      catch (e) { cornerstone.enable(element); }

      cornerstone.loadAndCacheImage(url).then((image) => {
        cornerstone.displayImage(element, image);
      }).catch(e => console.warn("Error miniatura:", e));
    };
    
    setTimeout(tryLoad, 50);

    return () => { 
        if(element) { try { cornerstone.disable(element); } catch(e) {} }
    };
  }, [url]);

  return <div ref={elementRef} style={{ width: "100%", height: "60px", backgroundColor: "#000", borderRadius: "4px", marginBottom: "4px", pointerEvents: "none" }} />;
};

export default function VisorDICOMWrapper({ estudioId, tokenPaciente, esPortalPaciente }) {
  const { id: paramId } = useParams(); 
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  const currentId = estudioId || paramId;
  const idReal = searchParams.get("id_real") || currentId; 
  
  const { user } = useAuth();
  
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarComparacion, setMostrarComparacion] = useState(null);
  const [mostrarPanelDictado, setMostrarPanelDictado] = useState(false);

  const MAX_VP = 16;
  const layoutsDisponibles = ["1x1", "1x2", "2x2", "2x3", "2x4", "3x3", "3x4", "4x4"];
  const [layout, setLayout] = useState("1x1"); 
  const [viewportActivo, setViewportActivo] = useState(0); 
  
  const [vpSeries, setVpSeries] = useState(Array(MAX_VP).fill(0));
  const [vpIndices, setVpIndices] = useState(Array(MAX_VP).fill(0));
  const [vpTags, setVpTags] = useState(Array(MAX_VP).fill(null));

  const dicomRefs = useRef(Array(MAX_VP).fill(null).map(() => React.createRef()));
  const prevSeriesRefs = useRef(Array(MAX_VP).fill(-1));

  const [isCinePlaying, setIsCinePlaying] = useState(false);
  const [cineSpeed, setCineSpeed] = useState(15); 
  const [herramientaActiva, setHerramientaActiva] = useState("Wwwc"); 
  const [mostrarMetadatos, setMostrarMetadatos] = useState(false);

  const tokenUrl = searchParams.get("token") || tokenPaciente;
  const isGuest = esPortalPaciente || !!tokenUrl;
  
  const rawLocalToken = localStorage.getItem("token") || "";
  const cleanLocalToken = rawLocalToken.replace(/['"]+/g, '');
  const activeToken = tokenUrl || cleanLocalToken;

  const userRol = String(user?.rol || "").toLowerCase().trim();
  const isRadiologo = !isGuest && (userRol === "radiologo" || userRol.startsWith("medico") || userRol === "superadmin");

  const getNumViewports = () => {
    if(layout === "1x1") return 1; if(layout === "1x2") return 2;
    if(layout === "2x2") return 4; if(layout === "2x3") return 6;
    if(layout === "2x4") return 8; if(layout === "3x3") return 9;
    if(layout === "3x4") return 12; if(layout === "4x4") return 16;
    return 1;
  };
  const numViewports = getNumViewports();

  // 🚀 DISTRIBUCIÓN ABSOLUTA Y ORDENADA DE SERIES (1 al N)
  useEffect(() => {
    if (series.length > 0) {
      // Solo redistribuimos automáticamente si el médico ABRE una cuadrícula múltiple.
      // Si está en 1x1, no tocamos nada para no borrar la imagen que él capturó.
      if (numViewports > 1) {
        setVpSeries(prev => {
          const next = [...prev];
          for (let i = 0; i < numViewports; i++) {
             if (i < series.length) {
                 next[i] = i; // Mapea Viewport 0 -> Serie 0, Viewport 1 -> Serie 1, etc.
             } else {
                 next[i] = -1; // Si no hay más series, la celda queda "SIN SERIE ASIGNADA"
             }
          }
          return next;
        });
        
        setVpIndices(prev => {
          const next = [...prev];
          for (let i = 0; i < numViewports; i++) next[i] = 0;
          return next;
        });
        
        setViewportActivo(0); // Resetea el borde amarillo al primer cuadro
      }
    }
  }, [layout, series.length]);

  const reajustarLienzos = () => {
    setTimeout(() => {
      for(let i=0; i < numViewports; i++){
        const el = dicomRefs.current[i].current;
        if (el) { try { cornerstone.resize(el, true); cornerstone.reset(el); } catch (e) {} }
      }
    }, 100);
  };

  useEffect(() => { reajustarLienzos(); }, [mostrarPanelDictado, layout]);

  useEffect(() => {
    if (!isGuest && cleanLocalToken) {
      cornerstoneWADOImageLoader.configure({
        beforeSend: function(xhr) { xhr.setRequestHeader('Authorization', `Bearer ${cleanLocalToken}`); }
      });
    }

    const fetchImagenes = async () => {
      if (!currentId) { setLoading(false); return; }
      try {
        let urlFetch = `${API_BASE}/api/estudios/${currentId}/imagenes`;
        const tokenSeguro = localStorage.getItem("token") || activeToken; 
        let headersFetch = { Authorization: `Bearer ${tokenSeguro}` };

        if (isGuest) { urlFetch = `${API_BASE}/api/secure-links/imagenes/${activeToken}`; headersFetch = {}; }

        const response = await fetch(urlFetch, { headers: headersFetch });
        if (!response.ok) throw new Error("Error en la autenticación o servidor.");
        const data = await response.json();
        
        if (data && data.length > 0) {
          const armarUrlDicom = (imgId) => isGuest ? `wadouri:${API_BASE}/api/secure-links/stream/${imgId}?token=${activeToken}` : `wadouri:${API_BASE}/api/dicom/stream/${imgId}?token=${tokenSeguro}`;
          let seriesProcesadas = data[0] && data[0].serie 
            ? data.map(s => ({ nombre: s.serie, urls: s.imagenes.map(img => armarUrlDicom(img.id)) }))
            : [{ nombre: "SERIE ÚNICA", urls: data.map(img => armarUrlDicom(img?.id || img)) }];
          setSeries(seriesProcesadas);
        }
      } catch (error) { console.error("Error cargando imágenes:", error); } 
      finally { setLoading(false); }
    };
    fetchImagenes();
  }, [currentId, activeToken, isGuest, cleanLocalToken]);

  useEffect(() => {
    window.addEventListener("resize", reajustarLienzos);
    return () => window.removeEventListener("resize", reajustarLienzos);
  }, [layout]);

  useEffect(() => {
    for(let i=0; i < numViewports; i++) {
      const el = dicomRefs.current[i].current;
      if (!el) continue;
      try { cornerstone.getEnabledElement(el); } catch (e) { cornerstone.enable(el); }
      cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
      cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
      cornerstoneTools.addTool(cornerstoneTools.PanTool);
      cornerstoneTools.addTool(cornerstoneTools.RotateTool);
      cornerstoneTools.addTool(cornerstoneTools.MagnifyTool);

      if (isRadiologo) {
        cornerstoneTools.addTool(cornerstoneTools.LengthTool);
        cornerstoneTools.addTool(cornerstoneTools.AngleTool);
        cornerstoneTools.addTool(cornerstoneTools.EllipticalRoiTool);
      }
      cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
    }
  }, [isRadiologo, layout]); 

  useEffect(() => {
    for(let i=0; i < numViewports; i++) {
      const el = dicomRefs.current[i].current;
      const serieIndex = vpSeries[i];
      
      if (serieIndex === -1 || !series[serieIndex]) continue;
      
      const imgs = series[serieIndex].urls;
      if (!el || imgs.length === 0) continue;
      
      try { cornerstone.getEnabledElement(el); } catch (e) { cornerstone.enable(el); }

      cornerstone.loadAndCacheImage(imgs[vpIndices[i]]).then((image) => {
        cornerstone.displayImage(el, image);
        
        if (prevSeriesRefs.current[i] !== serieIndex) {
            cornerstone.reset(el);
            prevSeriesRefs.current[i] = serieIndex;
        }

        if (image.data && vpIndices[i] === 0) { 
          setVpTags(prev => {
            const next = [...prev];
            next[i] = {
              paciente: image.data.string('x00100010') || 'Sin Nombre en DICOM',
              idPaciente: image.data.string('x00100020') || 'Sin ID',
              modalidad: image.data.string('x00080060') || 'N/A',
              fecha: image.data.string('x00080020') || 'N/A',
              estudio: image.data.string('x00081030') || 'Sin Descripción', 
              serie: image.data.string('x0008103e') || 'Sin Descripción'     
            };
            return next;
          });
        }
      }).catch(err => console.warn(`Error en viewport ${i+1}`, err));
    }
  }, [vpIndices, vpSeries, series, layout]);

  const setIndiceActualVp = (vpIndex, newIndice) => {
    setVpIndices(prev => { const next = [...prev]; next[vpIndex] = newIndice; return next; });
  };

  const setSerieActivaVp = (vpIndex, newSerie) => {
    setIsCinePlaying(false);
    setVpSeries(prev => { const next = [...prev]; next[vpIndex] = newSerie; return next; });
    setIndiceActualVp(vpIndex, 0);
  };

  useEffect(() => {
    let interval;
    if (isCinePlaying) {
      interval = setInterval(() => {
        setVpIndices(prev => {
            const next = [...prev];
            const serieIdx = vpSeries[viewportActivo];
            if (serieIdx === -1 || !series[serieIdx]) return next;
            
            const imgs = series[serieIdx].urls;
            if(imgs.length > 1) {
                next[viewportActivo] = next[viewportActivo] >= imgs.length - 1 ? 0 : next[viewportActivo] + 1;
            }
            return next;
        });
      }, 1000 / cineSpeed);
    }
    return () => clearInterval(interval);
  }, [isCinePlaying, cineSpeed, vpSeries, viewportActivo, series]);

  const handleWheel = (e, vp) => {
    setIsCinePlaying(false); 
    setViewportActivo(vp);
    
    const serieIdx = vpSeries[vp];
    if (serieIdx === -1 || !series[serieIdx]) return; 
    
    setVpIndices(prev => {
        const next = [...prev];
        const imgs = series[serieIdx].urls;
        if (e.deltaY > 0) next[vp] = Math.min(next[vp] + 1, Math.max(0, imgs.length - 1));
        else next[vp] = Math.max(next[vp] - 1, 0);
        return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) setIsCinePlaying(false); 
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setVpIndices(prev => {
            const next = [...prev];
            const serieIdx = vpSeries[viewportActivo];
            if (serieIdx === -1 || !series[serieIdx]) return next;
            const imgs = series[serieIdx].urls;
            next[viewportActivo] = Math.min(next[viewportActivo] + 1, Math.max(0, imgs.length - 1));
            return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setVpIndices(prev => {
            const next = [...prev];
            const serieIdx = vpSeries[viewportActivo];
            if (serieIdx === -1 || !series[serieIdx]) return next;
            next[viewportActivo] = Math.max(next[viewportActivo] - 1, 0);
            return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [vpSeries, viewportActivo, series]);

  const activarHerramienta = (nombreHerramienta) => {
    setHerramientaActiva(nombreHerramienta);
    if (nombreHerramienta === "Spin3D") {
      cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Pan", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Rotate", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Magnify", { mouseButtonMask: 0 });
    } else {
      cornerstoneTools.setToolActive(nombreHerramienta, { mouseButtonMask: 1 });
    }
  };

  const aplicarPresetVentana = (ww, wc) => {
    if(!ww || !wc) return;
    for(let i=0; i<numViewports; i++){
      const el = dicomRefs.current[i].current;
      if(!el) continue;
      const vp = cornerstone.getViewport(el);
      if (!vp) continue;
      vp.voi.windowWidth = ww;
      vp.voi.windowCenter = wc;
      cornerstone.setViewport(el, vp);
    }
  };

  const aplicarAccion = (accion) => {
    for(let i=0; i<numViewports; i++){
      const el = dicomRefs.current[i].current;
      if(!el) continue;
      if (accion === 'limpiar') {
        cornerstoneTools.clearToolState(el, "Length");
        cornerstoneTools.clearToolState(el, "Angle");
        cornerstoneTools.clearToolState(el, "EllipticalRoi");
        cornerstone.updateImage(el);
      } else {
        const vp = cornerstone.getViewport(el);
        if (!vp) continue;
        if (accion === 'negativo') vp.invert = !vp.invert;
        if (accion === 'flipH') vp.hflip = !vp.hflip;
        if (accion === 'flipV') vp.vflip = !vp.vflip;
        cornerstone.setViewport(el, vp);
      }
    }
  };

  const irASiguientePaciente = async () => {
    if (!window.confirm("¿Desea avanzar al siguiente paciente pendiente? Asegúrese de haber guardado (Enter) el dictado actual.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/pacientes`, { headers: isGuest ? {} : { Authorization: `Bearer ${activeToken}` } });
      const data = await res.json(); 
      const list = Array.isArray(data) ? data : (data.items || []);
      
      const pendientes = list.filter(e => ["Tomado", "Importado", "Rechazado"].includes(e.estado_pacs));
      const indexActual = pendientes.findIndex(e => String(e.estudio_interno_id) === String(currentId));
      
      if (indexActual !== -1 && indexActual < pendientes.length - 1) {
        const next = pendientes[indexActual + 1];
        window.location.href = `/imagenes-estudio/${next.estudio_interno_id}?id_real=${next.id}`;
      } else {
        alert("¡Excelente! No hay más estudios pendientes en la lista de trabajo.");
      }
    } catch (err) { alert("Error al buscar el siguiente paciente."); }
  };

  const alternarLayout = () => {
    const nextIndex = (layoutsDisponibles.indexOf(layout) + 1) % layoutsDisponibles.length;
    setLayout(layoutsDisponibles[nextIndex]);
  };

  // 🚀 ATRAPAR IMAGEN Y VOLVER A 1x1
  const restaurarAVistaUnica = () => {
    const serieAtrapada = vpSeries[viewportActivo];
    const indiceAtrapado = vpIndices[viewportActivo];
    
    setLayout("1x1");
    
    // Inyectamos la serie seleccionada directamente en el Cuadro 0
    setVpSeries(prev => {
        const next = [...prev];
        next[0] = serieAtrapada !== -1 ? serieAtrapada : 0;
        return next;
    });
    setVpIndices(prev => {
        const next = [...prev];
        next[0] = indiceAtrapado !== -1 ? indiceAtrapado : 0;
        return next;
    });
    setViewportActivo(0);
  };

  const abrirHistorialComparativo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/estudios/${currentId}/previo`, { headers: isGuest ? {} : { Authorization: `Bearer ${activeToken}` } });
      const data = await res.json(); 
      if (!data || data.length === 0) { alert("Este paciente no tiene estudios previos."); return; }

      const idEstudioPrevioInicial = data[0].id;
      const resPrevio = await fetch(`${API_BASE}/api/estudios/${idEstudioPrevioInicial}/imagenes`, { headers: isGuest ? {} : { Authorization: `Bearer ${activeToken}` } });
      const imgsPrevio = await resPrevio.json(); 
      if (!imgsPrevio || imgsPrevio.length === 0) { alert("El estudio previo no tiene imágenes."); return; }
      
      const tokenSeguro = localStorage.getItem("token") || activeToken;
      const seriesPreviasFormateadas = imgsPrevio.map(serie => {
        const urlsNuevas = serie.imagenes.map(img => {
          if (isGuest) return `wadouri:${API_BASE}/api/secure-links/stream/${img.id}?token=${activeToken}`;
          return `wadouri:${API_BASE}/api/dicom/stream/${img.id}?token=${tokenSeguro}`;
        });
        return { nombre: serie.serie || "Serie Previa", urls: urlsNuevas };
      });

      const seriesActualesFormateadas = series.map(s => ({
          nombre: s.nombre, urls: s.urls.map(u => u.includes("wadouri:") ? u : `wadouri:${u}`)
      }));

      if (seriesActualesFormateadas.length > 0 && seriesPreviasFormateadas.length > 0) {
        setMostrarComparacion({ 
            actual: seriesActualesFormateadas, previo: seriesPreviasFormateadas,
            listaHistorial: data, estudioSeleccionadoId: idEstudioPrevioInicial
        });
      }
    } catch (err) { alert("Error al intentar cargar el historial."); }
  };

  if (mostrarComparacion) {
    return (
      <div style={{ width: "100%", height: "100vh", backgroundColor: "#000" }}>
        <CompareViewer
          seriesA={mostrarComparacion.actual} seriesB={mostrarComparacion.previo}
          listaHistorial={mostrarComparacion.listaHistorial} estudioSeleccionadoId={mostrarComparacion.estudioSeleccionadoId} 
          onVolver={() => setMostrarComparacion(null)} activeToken={activeToken} API_BASE={API_BASE} isGuest={isGuest}
        />
      </div>
    );
  }

  const gridStyles = {
    "1x1": { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
    "1x2": { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" },
    "2x2": { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
    "2x3": { gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" },
    "2x4": { gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" },
    "3x3": { gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr" },
    "3x4": { gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr" },
    "4x4": { gridTemplateColumns: "1fr 1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr 1fr" },
  };

  return (
    <div style={styles.visorContainer}>
      
      <div style={styles.toolbarWrapper}>
        
        {/* FILA 1: Workflow, Navegación y Flujo de Trabajo */}
        <div style={styles.toolbarRow}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0, marginRight: "10px" }}>
            {!esPortalPaciente && <button style={styles.btnCerrar} onClick={() => window.close()}>Cerrar</button>} 
            <span style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "0.85rem" }}>Serie Activa</span>
          </div>

          <select style={styles.selectPreset} onChange={(e) => {
            const val = e.target.value;
            if(val) { const [ww, wl] = val.split(','); aplicarPresetVentana(Number(ww), Number(wl)); }
          }}>
            <option value="">⚙️ Filtros TAC</option>
            <option value="400,40">🥩 Tejidos Blandos</option>
            <option value="1500,300">🦴 Hueso</option>
            <option value="80,40">🧠 Cerebro</option>
            <option value="1500,-600">🫁 Pulmón</option>
            <option value="600,150">💉 Contraste/Angio</option>
          </select>
          
          <div style={styles.divisor} />
          
          {isRadiologo && (
            <>
              <button style={styles.btn3D} onClick={alternarLayout} title="Cambiar distribución de pantallas">🔲 Cuadrícula: {layout}</button>
              
              {/* 🚀 NUEVO BOTÓN 1x1 INTELIGENTE */}
              {layout !== "1x1" && (
                <button style={styles.btnToolActivoSeguridad} onClick={restaurarAVistaUnica} title="Atrapar imagen seleccionada y verla en pantalla completa">
                  ⏹️ 1x1
                </button>
              )}
              
              <button style={styles.btnEfilm} onClick={abrirHistorialComparativo}>📂 Historial</button>
              <button style={styles.btnInfo} onClick={irASiguientePaciente}>⏭️ Siguiente</button>
              <button style={mostrarPanelDictado ? styles.btnDictadoActivo : styles.btnDictado} onClick={() => setMostrarPanelDictado(!mostrarPanelDictado)}>🎙️ {mostrarPanelDictado ? "Cerrar Dictado" : "Dictar"}</button>
            </>
          )}

          <div style={styles.divisor} />
          <button style={mostrarMetadatos ? styles.btnToolActivoSeguridad : styles.btnToolSeguridad} onClick={() => setMostrarMetadatos(!mostrarMetadatos)}>🛡️ Info</button>
        </div>

        {/* FILA 2: Herramientas Físicas de Imagen */}
        <div style={styles.toolbarRowBottom}>
          <button style={herramientaActiva === "Wwwc" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Wwwc")}>🌓 Contraste</button>
          <button style={herramientaActiva === "Zoom" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Zoom")}>🔍 Zoom</button>
          <button style={herramientaActiva === "Magnify" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Magnify")}>🔎 Lupa</button>
          <button style={herramientaActiva === "Pan" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Pan")}>🖐️ Mover</button>
          <button style={herramientaActiva === "Rotate" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Rotate")}>🔄 Rotar</button>
          <button style={styles.btnTool} onClick={reajustarLienzos}>🏠 Ajustar</button>

          {isRadiologo && (
            <>
              <div style={styles.divisor} />
              <button style={herramientaActiva === "Length" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Length")}>📏 Medir</button>
              <button style={herramientaActiva === "Angle" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Angle")}>📐 Ángulo</button>
              <button style={herramientaActiva === "EllipticalRoi" ? styles.btnPremiumActivo : styles.btnPremium} onClick={() => activarHerramienta("EllipticalRoi")}>🎯 ROI</button>
              
              <button style={styles.btnPremium} onClick={() => aplicarAccion('negativo')}>🌗 Negativo</button>
              <button style={styles.btnLimpiar} onClick={() => aplicarAccion('limpiar')}>🧹 Limpiar</button>
              <button style={styles.btnTool} onClick={() => aplicarAccion('flipH')}>↔️ Flip H</button>
              <button style={styles.btnTool} onClick={() => aplicarAccion('flipV')}>↕️ Flip V</button>
            </>
          )}

          <div style={styles.divisor} />
          <button style={isCinePlaying ? styles.btnCineActivo : styles.btnCine} onClick={() => setIsCinePlaying(!isCinePlaying)}>{isCinePlaying ? "⏸️ Pausa" : "▶️ Cine"}</button>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#94a3b8", fontSize: "12px", marginLeft: "5px", flexShrink: 0 }}>
            <span style={{ minWidth: "40px" }}>{cineSpeed} FPS</span>
            <input type="range" min="1" max="60" value={cineSpeed} onChange={(e) => setCineSpeed(Number(e.target.value))} style={{ width: "60px", cursor: "pointer", accentColor: "#8b5cf6" }} />
          </div>
        </div>

      </div>

      <div style={styles.mainArea}>
        <div style={styles.sidebar}>
          <p style={{ color: "#94a3b8", textAlign: "center", fontSize: "11px", margin: "10px 0", fontWeight: "bold" }}>SERIES</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 8px", width: "100%", overflowY: "auto", maxHeight: "60vh" }}>
            {series.map((s, idx) => {
              const isActivo = vpSeries[viewportActivo] === idx;
              return (
                <button 
                  key={idx}
                  onClick={() => setSerieActivaVp(viewportActivo, idx)}
                  style={isActivo ? styles.serieActiva : styles.serieBtn}
                >
                  <SerieThumbnail url={s.urls[0]} />
                  <span style={{ fontSize: "12px", color: isActivo ? "#111827" : "#cbd5e1", fontWeight: "bold" }}>{s.urls.length} img</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.viewportContainer}>
          {loading ? (
            <h2 style={{ color: "#94a3b8" }}>Cargando Motor Médico...</h2>
          ) : series.length === 0 ? (
            <h2 style={{ color: "#ef4444" }}>No se encontraron archivos DICOM.</h2>
          ) : (
            <div style={{ display: 'grid', width: '100%', height: '100%', gap: '4px', ...gridStyles[layout] }}>
              
              {Array.from({ length: numViewports }).map((_, i) => {
                 const serieIdx = vpSeries[i];
                 const isVacia = serieIdx === -1 || !series[serieIdx];
                 
                 const imgsVp = isVacia ? [] : series[serieIdx].urls;
                 const tagsVp = vpTags[i];
                 
                 return (
                   <div 
                     key={i}
                     style={{ position: 'relative', border: viewportActivo === i ? "2px solid #fbbf24" : "1px solid #1e293b", transition: "0.2s", backgroundColor: "#000", overflow: 'hidden' }}
                     onClick={() => setViewportActivo(i)}
                   >
                     <div ref={dicomRefs.current[i]} style={styles.dicomElement} onContextMenu={(e) => e.preventDefault()} onWheel={(e) => handleWheel(e, i)} />
                     
                     {isVacia && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#07080a', zIndex: 25, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ color: '#1e293b', fontWeight: 'bold', fontSize: '1rem', letterSpacing: '2px' }}>SIN SERIE ASIGNADA</span>
                        </div>
                     )}

                     {!isVacia && imgsVp.length > 0 && (
                        <div style={styles.overlayTopLeft}>Corte {vpIndices[i] + 1} / {imgsVp.length}</div>
                     )}

                     {!isVacia && mostrarMetadatos && tagsVp && (
                       <div style={styles.overlayMetadatos}>
                         <h4 style={{ margin: "0 0 10px 0", color: "#fbbf24", borderBottom: "1px solid #fbbf24", paddingBottom: "5px" }}>
                           DATOS NATIVOS DEL ARCHIVO
                         </h4>
                         <p style={styles.metaText}><strong>Paciente:</strong> {tagsVp.paciente}</p>
                         <p style={styles.metaText}><strong>ID Original:</strong> {tagsVp.idPaciente}</p>
                         <p style={styles.metaText}><strong>Modalidad:</strong> {tagsVp.modalidad}</p>
                         <p style={styles.metaText}><strong>Fecha Estudio:</strong> {tagsVp.fecha}</p>
                         <p style={styles.metaText}><strong>Estudio:</strong> {tagsVp.estudio}</p>
                         <p style={styles.metaText}><strong>Serie (Corte):</strong> {tagsVp.serie}</p>
                       </div>
                     )}

                     {!isVacia && numViewports > 1 && imgsVp.length > 1 && (
                        <input type="range" min="0" max={imgsVp.length - 1} value={vpIndices[i]} onChange={(e) => { setIsCinePlaying(false); setIndiceActualVp(i, Number(e.target.value)); }} style={styles.sliderBottom} />
                     )}
                   </div>
                 );
              })}

            </div>
          )}
        </div>
      </div>
      
      {mostrarPanelDictado && (
        <div style={styles.panelDictado}>
          <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
             <ModalDictadoHardware isWindow={false} estudioIdProps={currentId} />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  visorContainer: { display: "flex", flexDirection: "column", height: "100%", width: "100%", backgroundColor: "#000", overflow: "hidden", fontFamily: "system-ui, sans-serif" },
  toolbarWrapper: { display: "flex", flexDirection: "column", backgroundColor: "#111418", borderBottom: "1px solid #1e293b", flexShrink: 0 },
  toolbarRow: { height: "55px", display: "flex", alignItems: "center", padding: "0 20px", gap: "10px", overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none" },
  toolbarRowBottom: { height: "50px", display: "flex", alignItems: "center", padding: "0 20px", gap: "6px", overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", borderTop: "1px solid #1e293b", backgroundColor: "#0f172a" },
  btnCerrar: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  selectPreset: { backgroundColor: "#1e293b", color: "#fbbf24", border: "1px solid #334155", padding: "8px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", outline: "none", flexShrink: 0 },
  btnTool: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", flexShrink: 0 },
  btnToolActivo: { backgroundColor: "#3b82f6", color: "#fff", border: "1px solid #2563eb", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", flexShrink: 0 },
  btnPremium: { backgroundColor: "#064e3b", color: "#d1fae5", border: "1px solid #047857", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", flexShrink: 0 },
  btnPremiumActivo: { backgroundColor: "#10b981", color: "#000", border: "1px solid #059669", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnLimpiar: { backgroundColor: "#7f1d1d", color: "#fecaca", border: "1px solid #991b1b", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", flexShrink: 0 },
  btnEfilm: { backgroundColor: "#b45309", color: "#fef3c7", border: "1px solid #92400e", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnDictado: { backgroundColor: "#4f46e5", color: "#e0e7ff", border: "1px solid #3730a3", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnDictadoActivo: { backgroundColor: "#6366f1", color: "#fff", border: "1px solid #4338ca", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnInfo: { backgroundColor: "#10b981", color: "#fff", border: "1px solid #059669", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  panelDictado: { height: "220px", backgroundColor: "#07080a", borderTop: "2px solid #38bdf8", flexShrink: 0, display: "flex", flexDirection: "column", padding: "5px", overflowY: "auto", transition: "height 0.3s ease" },
  btn3D: { backgroundColor: "#0284c7", color: "#e0f2fe", border: "1px solid #0369a1", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnCine: { backgroundColor: "#4c1d95", color: "#ede9fe", border: "1px solid #5b21b6", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnCineActivo: { backgroundColor: "#7c3aed", color: "#fff", border: "1px solid #6d28d9", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnToolSeguridad: { backgroundColor: "#0f766e", color: "#ccfbf1", border: "1px solid #115e59", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnToolActivoSeguridad: { backgroundColor: "#14b8a6", color: "#000", border: "1px solid #0d9488", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  divisor: { width: "1px", backgroundColor: "#475569", margin: "0 5px", height: "24px", flexShrink: 0 },
  mainArea: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: "120px", backgroundColor: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "10px 0", zIndex: 30 },
  serieBtn: { display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#1e293b", border: "1px solid #334155", padding: "6px", borderRadius: "4px", cursor: "pointer", transition: "0.2s" },
  serieActiva: { display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#fbbf24", border: "2px solid #f59e0b", padding: "5px", borderRadius: "4px", cursor: "pointer", boxShadow: "0 0 8px rgba(251, 191, 36, 0.6)" },
  viewportContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative", padding: "4px" },
  dicomElement: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  overlayTopLeft: { position: "absolute", top: "15px", left: "15px", color: "#fbbf24", fontSize: "14px", fontWeight: "bold", pointerEvents: "none", zIndex: 10, textShadow: "1px 1px 2px #000" },
  overlayMetadatos: { position: "absolute", bottom: "35px", left: "15px", backgroundColor: "rgba(15, 23, 42, 0.85)", color: "#fff", padding: "10px", borderRadius: "8px", border: "1px solid #334155", pointerEvents: "none", zIndex: 20, maxWidth: "250px", fontSize: "12px" },
  metaText: { margin: "2px 0", fontSize: "11px", color: "#e2e8f0" },
  sliderBottom: { position: "absolute", bottom: "10px", left: "5%", width: "90%", cursor: "pointer", accentColor: "#fbbf24", zIndex: 15 }
};