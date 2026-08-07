import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

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

const API_BASE = window.location.origin;

const SerieThumbnail = ({ url }) => {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current || !url) return;
    const element = elementRef.current;
    
    try { cornerstone.getEnabledElement(element); } 
    catch (e) { cornerstone.enable(element); }

    cornerstone.loadAndCacheImage(url).then((image) => {
      cornerstone.displayImage(element, image);
    }).catch(e => console.warn("Error cargando miniatura:", e));

    return () => {
      cornerstone.disable(element);
    };
  }, [url]);

  return (
    <div
      ref={elementRef}
      style={{
        width: "100%", height: "60px", backgroundColor: "#000",
        borderRadius: "4px", marginBottom: "4px", pointerEvents: "none" 
      }}
    />
  );
};

export default function VisorDICOMWrapper({ estudioId, tokenPaciente, esPortalPaciente }) {
  const { id: paramId } = useParams(); 
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  const currentId = estudioId || paramId;
  const idReal = searchParams.get("id_real") || currentId; 
  
  const { user } = useAuth();
  
  const [series, setSeries] = useState([]);
  const [serieActiva, setSerieActiva] = useState(0);
  const [indiceActual, setIndiceActual] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [isCinePlaying, setIsCinePlaying] = useState(false);
  const [cineSpeed, setCineSpeed] = useState(15); 
  
  const [herramientaActiva, setHerramientaActiva] = useState("Wwwc"); 
  const [mostrarMetadatos, setMostrarMetadatos] = useState(false);
  const [dicomTags, setDicomTags] = useState(null);

  const dicomElementRef = useRef(null);
  const isDragging3D = useRef(false);
  const lastMouseX = useRef(0);

  // 🔥 LÓGICA DE SEGURIDAD BLINDADA
  const tokenUrl = searchParams.get("token") || tokenPaciente;
  const isGuest = esPortalPaciente || !!tokenUrl;
  
  const rawLocalToken = localStorage.getItem("token") || "";
  const cleanLocalToken = rawLocalToken.replace(/['"]+/g, '');
  const activeToken = tokenUrl || cleanLocalToken;

  const userRol = String(user?.rol || "").toLowerCase().trim();
  const isRadiologo = !isGuest && (userRol === "radiologo" || userRol.startsWith("medico") || userRol === "superadmin");

  const imagenesActuales = series[serieActiva]?.urls || [];

  useEffect(() => {
    if (!isGuest && cleanLocalToken) {
      cornerstoneWADOImageLoader.configure({
        beforeSend: function(xhr) {
          xhr.setRequestHeader('Authorization', `Bearer ${cleanLocalToken}`);
        }
      });
    }

    const fetchImagenes = async () => {
      if (!currentId) {
        setLoading(false);
        return;
      }

      try {
        let urlFetch = `${API_BASE}/api/estudios/${currentId}/imagenes`;
        let headersFetch = { Authorization: `Bearer ${activeToken}` };

        if (isGuest) {
          urlFetch = `${API_BASE}/api/secure-links/imagenes/${activeToken}`;
          headersFetch = {}; 
        }

        const response = await fetch(urlFetch, { headers: headersFetch });
        
        if (!response.ok) throw new Error("Error en la autenticación o servidor.");
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          let seriesProcesadas = [];
          
          const armarUrlDicom = (imgId) => {
            if (isGuest) {
              return `wadouri:${API_BASE}/api/secure-links/stream/${imgId}?token=${activeToken}`;
            } else {
              return `wadouri:${API_BASE}/api/dicom/stream/${imgId}`;
            }
          };

          if (data[0] && data[0].serie) { 
            seriesProcesadas = data.map(s => ({
              nombre: s.serie,
              urls: s.imagenes.map(img => armarUrlDicom(img.id))
            }));
          } else { 
            seriesProcesadas = [{
              nombre: "SERIE ÚNICA",
              urls: data.map(img => armarUrlDicom(img?.id || img))
            }];
          }
          setSeries(seriesProcesadas);
        }
      } catch (error) {
        console.error("Error cargando imágenes del estudio:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchImagenes();
  }, [currentId, activeToken, isGuest, cleanLocalToken]);

  // 🚀 AUTO-AJUSTE AL GIRAR LA PANTALLA O CAMBIAR DE TAMAÑO
  useEffect(() => {
    const handleResize = () => {
      const element = dicomElementRef.current;
      if (element) {
        try {
          cornerstone.resize(element, true);
        } catch (e) {
          console.warn("Resize warning:", e);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!dicomElementRef.current || imagenesActuales.length === 0) return;
    const element = dicomElementRef.current;
    
    try { cornerstone.getEnabledElement(element); } 
    catch (e) { cornerstone.enable(element); }

    const WwwcTool = cornerstoneTools.WwwcTool; 
    const ZoomTool = cornerstoneTools.ZoomTool; 
    const PanTool = cornerstoneTools.PanTool;   
    const RotateTool = cornerstoneTools.RotateTool; 

    cornerstoneTools.addTool(WwwcTool);
    cornerstoneTools.addTool(ZoomTool);
    cornerstoneTools.addTool(PanTool);
    cornerstoneTools.addTool(RotateTool);

    if (isRadiologo) {
      const LengthTool = cornerstoneTools.LengthTool;
      const AngleTool = cornerstoneTools.AngleTool;
      cornerstoneTools.addTool(LengthTool);
      cornerstoneTools.addTool(AngleTool);
    }

    cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });

    return () => cornerstone.disable(element);
  }, [imagenesActuales.length, isRadiologo, serieActiva]);

  useEffect(() => {
    if (!dicomElementRef.current || imagenesActuales.length === 0) return;
    const element = dicomElementRef.current;

    cornerstone.loadAndCacheImage(imagenesActuales[indiceActual]).then((image) => {
      cornerstone.displayImage(element, image);

      if (image.data && indiceActual === 0) { 
        setDicomTags({
          paciente: image.data.string('x00100010') || 'Sin Nombre en DICOM',
          idPaciente: image.data.string('x00100020') || 'Sin ID en DICOM',
          modalidad: image.data.string('x00080060') || 'N/A',
          fecha: image.data.string('x00080020') || 'N/A',
          estudio: image.data.string('x00081030') || 'Sin Descripción de Estudio', 
          serie: image.data.string('x0008103e') || 'Sin Descripción de Serie',     
        });
      }
    }).catch(err => console.error("Error renderizando DICOM:", err));
  }, [indiceActual, imagenesActuales]);

  useEffect(() => {
    let interval;
    if (isCinePlaying && imagenesActuales.length > 1) {
      interval = setInterval(() => {
        setIndiceActual(prev => (prev >= imagenesActuales.length - 1 ? 0 : prev + 1)); 
      }, 1000 / cineSpeed);
    }
    return () => clearInterval(interval);
  }, [isCinePlaying, cineSpeed, imagenesActuales.length]);

  const handleWheel = (e) => {
    setIsCinePlaying(false); 
    if (e.deltaY > 0) {
      setIndiceActual(prev => Math.min(prev + 1, imagenesActuales.length - 1));
    } else {
      setIndiceActual(prev => Math.max(prev - 1, 0));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        setIsCinePlaying(false); 
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setIndiceActual(prev => Math.min(prev + 1, imagenesActuales.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setIndiceActual(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imagenesActuales.length]);

  const activarHerramienta = (nombreHerramienta) => {
    setHerramientaActiva(nombreHerramienta);
    if (nombreHerramienta === "Spin3D") {
      cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Pan", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 0 });
      cornerstoneTools.setToolActive("Rotate", { mouseButtonMask: 0 });
    } else {
      cornerstoneTools.setToolActive(nombreHerramienta, { mouseButtonMask: 1 });
    }
  };

  const handleMouseDown = (e) => {
    if (herramientaActiva === "Spin3D" && e.button === 0) {
      isDragging3D.current = true;
      lastMouseX.current = e.clientX;
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging3D.current && herramientaActiva === "Spin3D") {
      const deltaX = e.clientX - lastMouseX.current;
      const sensibilidad = 8; 
      
      if (Math.abs(deltaX) > sensibilidad) {
        setIsCinePlaying(false);
        setIndiceActual((prev) => {
          let next = deltaX > 0 ? prev + 1 : prev - 1;
          if (next >= imagenesActuales.length) next = 0; 
          if (next < 0) next = imagenesActuales.length - 1;
          return next;
        });
        lastMouseX.current = e.clientX;
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    isDragging3D.current = false;
  };

  return (
    <div style={styles.visorContainer}>
      
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          {!esPortalPaciente && (
            <button style={styles.btnCerrar} onClick={() => window.close()}>Cerrar</button>
          )}
          <span style={{ color: "#fbbf24", fontWeight: "bold", marginLeft: "10px", fontSize: "0.85rem" }}>
            ID: {idReal}
          </span>
        </div>

        {/* 🚀 BARRA SUPERIOR CON SCROLL HORIZONTAL TÁCTIL PARA MÓVILES */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", overflowX: "auto", flex: 1, paddingLeft: "10px", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <button style={herramientaActiva === "Wwwc" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Wwwc")}>🌓 Contraste</button>
          <button style={herramientaActiva === "Zoom" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Zoom")}>🔍 Zoom</button>
          <button style={herramientaActiva === "Pan" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Pan")}>🖐️ Mover</button>
          <button style={herramientaActiva === "Rotate" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Rotate")}>🔄 Rotar</button>
          
          <button 
            style={styles.btnTool} 
            onClick={() => {
              const element = dicomElementRef.current;
              if (element) {
                cornerstone.resize(element, true);
                cornerstone.reset(element);
              }
            }}
            title="Ajustar imagen a la pantalla"
          >
            🏠 Ajustar
          </button>

          {isRadiologo && (
            <>
              <div style={styles.divisor} />
              <button style={herramientaActiva === "Length" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Length")}>📏 Medir</button>
              <button style={herramientaActiva === "Angle" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Angle")}>📐 Ángulo</button>
            </>
          )}

          {imagenesActuales.length > 1 && (
            <>
              <div style={styles.divisor} />
              <button 
                style={herramientaActiva === "Spin3D" ? styles.btn3DActivo : styles.btn3D} 
                onClick={() => activarHerramienta("Spin3D")}
                title="Girar en 3D"
              >
                🧊 Giro 3D
              </button>

              <button 
                style={isCinePlaying ? styles.btnCineActivo : styles.btnCine}
                onClick={() => setIsCinePlaying(!isCinePlaying)}
              >
                {isCinePlaying ? "⏸️ Pausa" : "▶️ Cine"}
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#94a3b8", fontSize: "12px", marginLeft: "5px", flexShrink: 0 }}>
                <span style={{ minWidth: "40px" }}>{cineSpeed} FPS</span>
                <input 
                  type="range" min="1" max="60" value={cineSpeed} 
                  onChange={(e) => setCineSpeed(Number(e.target.value))} 
                  style={{ width: "60px", cursor: "pointer", accentColor: "#8b5cf6" }}
                />
              </div>
            </>
          )}

          <div style={styles.divisor} />
          <button 
            style={mostrarMetadatos ? styles.btnToolActivoSeguridad : styles.btnToolSeguridad} 
            onClick={() => setMostrarMetadatos(!mostrarMetadatos)}
          >
            🛡️ Info
          </button>
        </div>
      </div>

      <div style={styles.mainArea}>
        
        <div style={styles.sidebar}>
          <p style={{ color: "#94a3b8", textAlign: "center", fontSize: "11px", margin: "10px 0", fontWeight: "bold" }}>
            SERIES
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 8px", width: "100%", overflowY: "auto", maxHeight: "60vh" }}>
            {series.map((s, idx) => (
              <button 
                key={idx}
                onClick={() => { setSerieActiva(idx); setIndiceActual(0); setIsCinePlaying(false); }}
                style={serieActiva === idx ? styles.serieActiva : styles.serieBtn}
                title={`Serie ${idx + 1}`}
              >
                <SerieThumbnail url={s.urls[0]} />
                <span style={{ fontSize: "12px", color: serieActiva === idx ? "#111827" : "#cbd5e1", fontWeight: "bold" }}>
                  {s.urls.length} img
                </span>
              </button>
            ))}
          </div>

          {imagenesActuales.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", marginTop: "15px" }}>
              <input 
                type="range" min="0" max={imagenesActuales.length - 1} value={indiceActual} 
                onChange={(e) => {
                  setIsCinePlaying(false);
                  setIndiceActual(Number(e.target.value));
                }}
                style={styles.verticalSlider}
              />
              <p style={{ color: "#fbbf24", textAlign: "center", fontSize: "14px", fontWeight: "bold", marginTop: "15px" }}>
                #{indiceActual + 1}
              </p>
            </div>
          )}
        </div>

        <div style={styles.viewportContainer}>
          {loading ? (
            <h2 style={{ color: "#94a3b8" }}>Cargando Motor Médico...</h2>
          ) : imagenesActuales.length === 0 ? (
            <h2 style={{ color: "#ef4444" }}>No se encontraron archivos DICOM para este estudio.</h2>
          ) : (
            <div 
              ref={dicomElementRef} 
              style={styles.dicomElement}
              onContextMenu={(e) => e.preventDefault()} 
              onWheel={handleWheel} 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              <div style={styles.overlayTopLeft}>
                Corte {indiceActual + 1} / {imagenesActuales.length}
              </div>

              {mostrarMetadatos && dicomTags && (
                <div style={styles.overlayMetadatos}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#fbbf24", borderBottom: "1px solid #fbbf24", paddingBottom: "5px" }}>
                    DATOS NATIVOS DEL ARCHIVO
                  </h4>
                  <p style={styles.metaText}><strong>Paciente:</strong> {dicomTags.paciente}</p>
                  <p style={styles.metaText}><strong>ID Original:</strong> {dicomTags.idPaciente}</p>
                  <p style={styles.metaText}><strong>Modalidad:</strong> {dicomTags.modalidad}</p>
                  <p style={styles.metaText}><strong>Fecha Estudio:</strong> {dicomTags.fecha}</p>
                  <p style={styles.metaText}><strong>Estudio:</strong> {dicomTags.estudio}</p>
                  <p style={styles.metaText}><strong>Serie (Corte):</strong> {dicomTags.serie}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  visorContainer: { display: "flex", flexDirection: "column", height: "100%", width: "100%", backgroundColor: "#000", overflow: "hidden", fontFamily: "system-ui, sans-serif" },
  toolbar: { height: "60px", backgroundColor: "#111418", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 },
  btnCerrar: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  btnTool: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s", flexShrink: 0 },
  btnToolActivo: { backgroundColor: "#3b82f6", color: "#fff", border: "1px solid #2563eb", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", flexShrink: 0 },
  btn3D: { backgroundColor: "#0284c7", color: "#e0f2fe", border: "1px solid #0369a1", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btn3DActivo: { backgroundColor: "#38bdf8", color: "#000", border: "1px solid #0284c7", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(56, 189, 248, 0.5)", flexShrink: 0 },
  btnCine: { backgroundColor: "#4c1d95", color: "#ede9fe", border: "1px solid #5b21b6", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnCineActivo: { backgroundColor: "#7c3aed", color: "#fff", border: "1px solid #6d28d9", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(124, 58, 237, 0.5)", flexShrink: 0 },
  btnToolSeguridad: { backgroundColor: "#0f766e", color: "#ccfbf1", border: "1px solid #115e59", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 },
  btnToolActivoSeguridad: { backgroundColor: "#14b8a6", color: "#000", border: "1px solid #0d9488", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(20, 184, 166, 0.5)", flexShrink: 0 },
  divisor: { width: "1px", backgroundColor: "#475569", margin: "0 5px", height: "24px", flexShrink: 0 },
  mainArea: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: "120px", backgroundColor: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "10px 0" },
  serieBtn: { display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#1e293b", border: "1px solid #334155", padding: "6px", borderRadius: "4px", cursor: "pointer", transition: "0.2s" },
  serieActiva: { display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#fbbf24", border: "2px solid #f59e0b", padding: "5px", borderRadius: "4px", cursor: "pointer", boxShadow: "0 0 8px rgba(251, 191, 36, 0.6)" },
  verticalSlider: { WebkitAppearance: "slider-vertical", width: "100%", height: "100%", cursor: "ns-resize", accentColor: "#fbbf24", transform: "rotate(180deg)" },
  viewportContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" },
  dicomElement: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  overlayTopLeft: { position: "absolute", top: "15px", left: "15px", color: "#fbbf24", fontSize: "14px", fontWeight: "bold", pointerEvents: "none", zIndex: 10 },
  overlayMetadatos: { position: "absolute", bottom: "20px", left: "20px", backgroundColor: "rgba(15, 23, 42, 0.85)", color: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #334155", pointerEvents: "none", zIndex: 20, backdropFilter: "blur(4px)", minWidth: "250px" },
  metaText: { margin: "4px 0", fontSize: "13px", color: "#e2e8f0" }
};