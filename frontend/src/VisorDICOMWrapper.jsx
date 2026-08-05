import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

import cornerstone from "cornerstone-core";
import cornerstoneTools from "cornerstone-tools";
import cornerstoneMath from "cornerstone-math";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import dicomParser from "dicom-parser";
import Hammer from "hammerjs";

// Inicialización
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

cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr) {
    const token = localStorage.getItem("token");
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }
});

cornerstoneTools.init({ globalToolSyncEnabled: true, showSVGCursors: true });

export default function VisorDICOMWrapper() {
  const { id } = useParams(); 
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idReal = searchParams.get("id_real") || id; 
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [indiceActual, setIndiceActual] = useState(0);
  const [isCinePlaying, setIsCinePlaying] = useState(false);
  const [cineSpeed, setCineSpeed] = useState(15); 
  
  const [herramientaActiva, setHerramientaActiva] = useState("Wwwc"); 
  const [mostrarMetadatos, setMostrarMetadatos] = useState(false);
  const [dicomTags, setDicomTags] = useState(null);

  const dicomElementRef = useRef(null);
  const token = localStorage.getItem("token");

  const userRol = String(user?.rol || "").toLowerCase().trim();
  const isRadiologo = userRol === "radiologo" || userRol.startsWith("medico") || userRol === "superadmin";

  useEffect(() => {
    const fetchImagenes = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/estudios/${id}/imagenes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        const dicomUrls = (data || []).map(img => `wadouri:http://localhost:8000/api/dicom/stream/${img.id}`);
        setImagenes(dicomUrls);
      } catch (error) {
        console.error("Error cargando metadatos del estudio:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchImagenes();
  }, [id, token]);

  useEffect(() => {
    if (!dicomElementRef.current || imagenes.length === 0) return;
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
  }, [imagenes.length, isRadiologo]);

  useEffect(() => {
    if (!dicomElementRef.current || imagenes.length === 0) return;
    const element = dicomElementRef.current;

    cornerstone.loadAndCacheImage(imagenes[indiceActual]).then((image) => {
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
  }, [indiceActual, imagenes]);

  useEffect(() => {
    let interval;
    if (isCinePlaying && imagenes.length > 1) {
      interval = setInterval(() => {
        setIndiceActual(prev => (prev >= imagenes.length - 1 ? 0 : prev + 1)); 
      }, 1000 / cineSpeed);
    }
    return () => clearInterval(interval);
  }, [isCinePlaying, cineSpeed, imagenes.length]);

  // 🔥 EVENTOS DE RATÓN Y TECLADO SINCRONIZADOS AL MOVIMIENTO NATURAL
  const handleWheel = (e) => {
    setIsCinePlaying(false); 
    // Rueda hacia abajo = Avanzar índice (bajar en el escáner del paciente)
    if (e.deltaY > 0) {
      setIndiceActual(prev => Math.min(prev + 1, imagenes.length - 1));
    } else {
      setIndiceActual(prev => Math.max(prev - 1, 0));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        setIsCinePlaying(false); 
      }
      // 🔥 Flecha Abajo = Avanzar índice (bajar en la columna)
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        setIndiceActual(prev => Math.min(prev + 1, imagenes.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        setIndiceActual(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imagenes.length]);

  const activarHerramienta = (nombreHerramienta) => {
    setHerramientaActiva(nombreHerramienta);
    cornerstoneTools.setToolActive(nombreHerramienta, { mouseButtonMask: 1 });
  };

  return (
    <div style={styles.visorContainer}>
      
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button style={styles.btnCerrar} onClick={() => window.close()}>Cerrar Visor</button>
          <span style={{ color: "#fbbf24", fontWeight: "bold", marginLeft: "15px" }}>
            ESTUDIO ID: {idReal}
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={herramientaActiva === "Wwwc" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Wwwc")}>🌓 Contraste</button>
          <button style={herramientaActiva === "Zoom" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Zoom")}>🔍 Zoom</button>
          <button style={herramientaActiva === "Pan" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Pan")}>🖐️ Mover</button>
          
          {isRadiologo && (
            <>
              <div style={styles.divisor} />
              <button style={herramientaActiva === "Length" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Length")}>📏 Medir</button>
              <button style={herramientaActiva === "Angle" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Angle")}>📐 Ángulo</button>
            </>
          )}

          {imagenes.length > 1 && (
            <>
              <div style={styles.divisor} />
              <button 
                style={isCinePlaying ? styles.btnCineActivo : styles.btnCine}
                onClick={() => setIsCinePlaying(!isCinePlaying)}
              >
                {isCinePlaying ? "⏸️ Detener" : "▶️ Cine"}
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#94a3b8", fontSize: "12px", marginLeft: "5px" }}>
                <span style={{ minWidth: "45px" }}>{cineSpeed} FPS</span>
                <input 
                  type="range" min="1" max="60" value={cineSpeed} 
                  onChange={(e) => setCineSpeed(Number(e.target.value))} 
                  style={{ width: "70px", cursor: "pointer", accentColor: "#8b5cf6" }}
                />
              </div>
            </>
          )}

          <div style={styles.divisor} />
          <button 
            style={mostrarMetadatos ? styles.btnToolActivoSeguridad : styles.btnToolSeguridad} 
            onClick={() => setMostrarMetadatos(!mostrarMetadatos)}
          >
            🛡️ INFO DICOM
          </button>
        </div>
      </div>

      <div style={styles.mainArea}>
        
        {imagenes.length > 1 && (
          <div style={styles.sidebar}>
            <p style={{ color: "#94a3b8", textAlign: "center", fontSize: "10px", marginBottom: "15px", fontWeight: "bold" }}>
              CORTES<br/><span style={{ color: "#fff", fontSize: "14px" }}>{imagenes.length}</span>
            </p>
            
            <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", margin: "10px 0" }}>
              <input 
                type="range" min="0" max={imagenes.length - 1} value={indiceActual} 
                onChange={(e) => {
                  setIsCinePlaying(false);
                  setIndiceActual(Number(e.target.value));
                }}
                style={styles.verticalSlider}
              />
            </div>

            <p style={{ color: "#fbbf24", textAlign: "center", fontSize: "14px", fontWeight: "bold", marginTop: "15px" }}>
              #{indiceActual + 1}
            </p>
          </div>
        )}

        <div style={styles.viewportContainer}>
          {loading ? (
            <h2 style={{ color: "#94a3b8" }}>Cargando Motor Médico...</h2>
          ) : imagenes.length === 0 ? (
            <h2 style={{ color: "#ef4444" }}>No se encontraron archivos DICOM para este estudio.</h2>
          ) : (
            <div 
              ref={dicomElementRef} 
              style={styles.dicomElement}
              onContextMenu={(e) => e.preventDefault()} 
              onWheel={handleWheel} 
            >
              <div style={styles.overlayTopLeft}>
                Corte {indiceActual + 1} / {imagenes.length}
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
  visorContainer: { display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "#000", overflow: "hidden", fontFamily: "system-ui, sans-serif" },
  toolbar: { height: "60px", backgroundColor: "#111418", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" },
  btnCerrar: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  btnTool: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" },
  btnToolActivo: { backgroundColor: "#3b82f6", color: "#fff", border: "1px solid #2563eb", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "600" },
  btnCine: { backgroundColor: "#4c1d95", color: "#ede9fe", border: "1px solid #5b21b6", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  btnCineActivo: { backgroundColor: "#7c3aed", color: "#fff", border: "1px solid #6d28d9", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(124, 58, 237, 0.5)" },
  btnToolSeguridad: { backgroundColor: "#0f766e", color: "#ccfbf1", border: "1px solid #115e59", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  btnToolActivoSeguridad: { backgroundColor: "#14b8a6", color: "#000", border: "1px solid #0d9488", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(20, 184, 166, 0.5)" },
  divisor: { width: "1px", backgroundColor: "#475569", margin: "0 5px", height: "24px" },
  mainArea: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: { width: "70px", backgroundColor: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "15px 5px" },
  
  // 🔥 SE HA ROTADO EL SLIDER 180 GRADOS PARA INVERTIR SU LÓGICA VISUAL Y FÍSICA
  verticalSlider: { WebkitAppearance: "slider-vertical", width: "100%", height: "100%", cursor: "ns-resize", accentColor: "#fbbf24", transform: "rotate(180deg)" },
  
  viewportContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" },
  dicomElement: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  overlayTopLeft: { position: "absolute", top: "15px", left: "15px", color: "#fbbf24", fontSize: "14px", fontWeight: "bold", pointerEvents: "none", zIndex: 10 },
  overlayMetadatos: { position: "absolute", bottom: "20px", left: "20px", backgroundColor: "rgba(15, 23, 42, 0.85)", color: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #334155", pointerEvents: "none", zIndex: 20, backdropFilter: "blur(4px)", minWidth: "250px" },
  metaText: { margin: "4px 0", fontSize: "13px", color: "#e2e8f0" }
};