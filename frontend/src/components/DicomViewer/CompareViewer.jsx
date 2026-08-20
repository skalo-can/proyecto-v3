/**
 * CompareViewer.jsx — MI_PACS
 * ---------------------------------------------------------
 * Comparación clínica lado a lado (Estilo eFilm) en Cornerstone V4.
 * ✔ Herramientas Premium, Galerías, Sincronización y CINE.
 * ✔ Solución de salto doble aplicada.
 * ✔ Control total por teclado (Flechas) inteligente por Hover.
 */

import React, { useEffect, useState, useRef } from "react";
import cornerstone from "cornerstone-core";
import cornerstoneTools from "cornerstone-tools";

// --- Subcomponente para renderizar la Miniatura (Thumbnail) ---
const Thumb = ({ url, onClick, activo, count }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !url) return;
    const el = ref.current;
    try { cornerstone.getEnabledElement(el); } catch (e) { cornerstone.enable(el); }
    let safeUrl = url.startsWith("wadouri:") ? url : `wadouri:${url}`;
    cornerstone.loadAndCacheImage(safeUrl).then(img => cornerstone.displayImage(el, img)).catch(e => {});
    return () => cornerstone.disable(el);
  }, [url]);

  return (
    <div onClick={onClick} style={{ minWidth: "70px", cursor: "pointer", border: activo ? "2px solid #fbbf24" : "1px solid #334155", borderRadius: "4px", backgroundColor: "#000", padding: "2px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div ref={ref} style={{ width: "60px", height: "60px", pointerEvents: "none" }} />
      <span style={{ color: activo ? "#fbbf24" : "#94a3b8", fontSize: "10px", marginTop: "2px", fontWeight: "bold" }}>{count} img</span>
    </div>
  );
};

export default function CompareViewer({ seriesA, seriesB, onVolver }) {
  const dicomLeftRef = useRef(null);
  const dicomRightRef = useRef(null);

  // Estados de Series e Índices
  const [serieLeft, setSerieLeft] = useState(0);
  const [serieRight, setSerieRight] = useState(0);
  const [indexLeft, setIndexLeft] = useState(0);
  const [indexRight, setIndexRight] = useState(0);

  // Estados de Herramientas y Visor
  const [syncScroll, setSyncScroll] = useState(true);
  const [herramientaActiva, setHerramientaActiva] = useState("Wwwc");
  
  const [infoLeft, setInfoLeft] = useState(false);
  const [infoRight, setInfoRight] = useState(false);
  
  const [cineLeft, setCineLeft] = useState(false);
  const [cineRight, setCineRight] = useState(false);
  const [cineSpeed, setCineSpeed] = useState(15);

  // Variables para arrastre 3D y Teclado Inteligente
  const drag3D = useRef({ activeL: false, activeR: false, lastX: 0 });
  const panelHover = useRef('L'); // Sabe dónde está el mouse para el teclado

  // URLs activas según la serie seleccionada
  const urlsA = seriesA?.[serieLeft]?.urls || [];
  const urlsB = seriesB?.[serieRight]?.urls || [];

  // Inicializar Cornerstone
  useEffect(() => {
    const elLeft = dicomLeftRef.current;
    const elRight = dicomRightRef.current;
    if (elLeft) { try { cornerstone.getEnabledElement(elLeft); } catch (e) { cornerstone.enable(elLeft); } }
    if (elRight) { try { cornerstone.getEnabledElement(elRight); } catch (e) { cornerstone.enable(elRight); } }

    const tools = [ cornerstoneTools.WwwcTool, cornerstoneTools.ZoomTool, cornerstoneTools.PanTool, cornerstoneTools.RotateTool, cornerstoneTools.LengthTool, cornerstoneTools.AngleTool, cornerstoneTools.EllipticalRoiTool ];
    tools.forEach(tool => { try { cornerstoneTools.addTool(tool); } catch(e) {} });
    cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });

    return () => {
      if (elLeft) cornerstone.disable(elLeft);
      if (elRight) cornerstone.disable(elRight);
    };
  }, []);

  // Cargar Imagen Izquierda
  useEffect(() => {
    if (urlsA.length === 0 || !dicomLeftRef.current) return;
    let url = urlsA[indexLeft];
    if (!url) return;
    if (!url.startsWith("wadouri:")) url = `wadouri:${url}`;
    cornerstone.loadAndCacheImage(url).then(img => cornerstone.displayImage(dicomLeftRef.current, img)).catch(e=>{});
  }, [indexLeft, urlsA]);

  // Cargar Imagen Derecha
  useEffect(() => {
    if (urlsB.length === 0 || !dicomRightRef.current) return;
    let url = urlsB[indexRight];
    if (!url) return;
    if (!url.startsWith("wadouri:")) url = `wadouri:${url}`;
    cornerstone.loadAndCacheImage(url).then(img => cornerstone.displayImage(dicomRightRef.current, img)).catch(e=>{});
  }, [indexRight, urlsB]);

  // Lógica de Movimiento Corregida (Sin saltos dobles)
  const moverIzquierda = (delta) => {
    const maxL = Math.max(0, urlsA.length - 1);
    const maxR = Math.max(0, urlsB.length - 1);
    
    setIndexLeft(prev => Math.min(Math.max(prev + delta, 0), maxL));
    if (syncScroll) {
      setIndexRight(prev => Math.min(Math.max(prev + delta, 0), maxR));
    }
  };

  const moverDerecha = (delta) => {
    const maxL = Math.max(0, urlsA.length - 1);
    const maxR = Math.max(0, urlsB.length - 1);

    setIndexRight(prev => Math.min(Math.max(prev + delta, 0), maxR));
    if (syncScroll) {
      setIndexLeft(prev => Math.min(Math.max(prev + delta, 0), maxL));
    }
  };

  // ⌨️ EVENTOS DE TECLADO (Flechas de navegación)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault(); // Evita que la página web entera haga scroll
        
        // Pausar el cine si el médico toca el teclado manualmente
        setCineLeft(false);
        setCineRight(false);
        
        const delta = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : -1;
        
        // Mover el panel donde el mouse esté flotando actualmente
        if (panelHover.current === 'L') {
          moverIzquierda(delta);
        } else {
          moverDerecha(delta);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [urlsA.length, urlsB.length, syncScroll]);

  // Motor de Cine
  useEffect(() => {
    let intervalo;
    if (cineLeft || cineRight) {
      intervalo = setInterval(() => {
        if (cineLeft && !syncScroll) moverIzquierda(1);
        if (cineRight && !syncScroll) moverDerecha(1);
        if (syncScroll && (cineLeft || cineRight)) moverIzquierda(1);
      }, 1000 / cineSpeed);
    }
    return () => clearInterval(intervalo);
  }, [cineLeft, cineRight, syncScroll, cineSpeed, urlsA.length, urlsB.length]);

  // Eventos de Mouse (Giro 3D)
  const handleMouse = (lado, tipo, e) => {
    if (herramientaActiva !== "Spin3D") return;
    if (tipo === 'down' && e.button === 0) {
      drag3D.current[lado === 'L' ? 'activeL' : 'activeR'] = true;
      drag3D.current.lastX = e.clientX;
    } else if (tipo === 'move') {
      const isDragging = lado === 'L' ? drag3D.current.activeL : drag3D.current.activeR;
      if (isDragging) {
        const deltaX = e.clientX - drag3D.current.lastX;
        if (Math.abs(deltaX) > 8) {
           lado === 'L' ? moverIzquierda(deltaX > 0 ? 1 : -1) : moverDerecha(deltaX > 0 ? 1 : -1);
           drag3D.current.lastX = e.clientX;
        }
      }
    } else {
      drag3D.current.activeL = false;
      drag3D.current.activeR = false;
    }
  };

  // Acciones de Herramientas
  const activarHerramienta = (nombre) => {
    setHerramientaActiva(nombre);
    if (nombre === "Spin3D") {
      cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 0 }); 
    } else {
      cornerstoneTools.setToolActive(nombre, { mouseButtonMask: 1 });
    }
  };

  const aplicarAccion = (lado, accion) => {
    const el = lado === 'L' ? dicomLeftRef.current : dicomRightRef.current;
    if (!el) return;
    if (accion === 'ajustar') { cornerstone.reset(el); cornerstone.resize(el, true); return; }
    
    const vp = cornerstone.getViewport(el);
    if (!vp) return;
    if (accion === 'invert') vp.invert = !vp.invert;
    if (accion === 'flipH') vp.hflip = !vp.hflip;
    if (accion === 'flipV') vp.vflip = !vp.vflip;
    if (accion === 'clear') { cornerstoneTools.clearToolState(el, "Length"); cornerstoneTools.clearToolState(el, "Angle"); cornerstoneTools.clearToolState(el, "EllipticalRoi"); }
    
    cornerstone.setViewport(el, vp);
    if (accion === 'clear') cornerstone.updateImage(el);
  };

  // ESTILOS DE INTERFAZ
  const styles = {
    btnTool: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnToolActivo: { backgroundColor: "#3b82f6", color: "#fff", border: "1px solid #2563eb", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnPremium: { backgroundColor: "#064e3b", color: "#d1fae5", border: "1px solid #047857", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnPremiumActivo: { backgroundColor: "#10b981", color: "#000", border: "1px solid #059669", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnDanger: { backgroundColor: "#7f1d1d", color: "#fecaca", border: "1px solid #991b1b", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btn3D: { backgroundColor: "#0284c7", color: "#e0f2fe", border: "1px solid #0369a1", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btn3DActivo: { backgroundColor: "#38bdf8", color: "#000", border: "1px solid #0284c7", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnCine: { backgroundColor: "#4c1d95", color: "#ede9fe", border: "1px solid #5b21b6", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnCineActivo: { backgroundColor: "#7c3aed", color: "#fff", border: "1px solid #6d28d9", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnInfo: { backgroundColor: "#0f766e", color: "#ccfbf1", border: "1px solid #115e59", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    btnInfoActivo: { backgroundColor: "#14b8a6", color: "#000", border: "1px solid #0d9488", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 },
    divisor: { width: "1px", backgroundColor: "#475569", margin: "0 5px", height: "20px", flexShrink: 0 },
    dicomBox: { width: "100%", height: "55vh", position: "relative", backgroundColor: "#000", border: "1px solid #334155", borderRadius: "4px", overflow: "hidden" },
    overlayText: { position: "absolute", top: "10px", left: "10px", color: "#fbbf24", fontWeight: "bold", zIndex: 10, pointerEvents: "none", fontSize: "14px" },
    overlayInfo: { position: "absolute", bottom: "10px", right: "10px", color: "#fff", backgroundColor: "rgba(0,0,0,0.7)", padding: "10px", borderRadius: "4px", zIndex: 10, pointerEvents: "none", fontSize: "12px", border: "1px solid #fbbf24" }
  };

  const renderToolbar = (lado) => {
    const isL = lado === 'L';
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", overflowX: "auto", paddingBottom: "5px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <button style={herramientaActiva === "Wwwc" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Wwwc")}>🌓 Contraste</button>
        <button style={herramientaActiva === "Zoom" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Zoom")}>🔍 Zoom</button>
        <button style={herramientaActiva === "Pan" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Pan")}>🖐️ Mover</button>
        <button style={herramientaActiva === "Rotate" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Rotate")}>🔄 Rotar</button>
        <button style={styles.btnTool} onClick={() => aplicarAccion(lado, 'ajustar')}>🏠 Ajustar</button>

        <div style={styles.divisor} />

        <button style={herramientaActiva === "Length" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Length")}>📏 Medir</button>
        <button style={herramientaActiva === "Angle" ? styles.btnToolActivo : styles.btnTool} onClick={() => activarHerramienta("Angle")}>📐 Ángulo</button>
        <button style={herramientaActiva === "EllipticalRoi" ? styles.btnPremiumActivo : styles.btnPremium} onClick={() => activarHerramienta("EllipticalRoi")}>🎯 ROI</button>
        
        <button style={styles.btnPremium} onClick={() => aplicarAccion(lado, 'invert')}>🌗 Negativo</button>
        <button style={styles.btnDanger} onClick={() => aplicarAccion(lado, 'clear')}>🧹 Limpiar</button>
        
        <button style={styles.btnTool} onClick={() => aplicarAccion(lado, 'flipH')}>↔️ Flip H</button>
        <button style={styles.btnTool} onClick={() => aplicarAccion(lado, 'flipV')}>↕️ Flip V</button>

        <div style={styles.divisor} />

        <button style={herramientaActiva === "Spin3D" ? styles.btn3DActivo : styles.btn3D} onClick={() => activarHerramienta("Spin3D")}>🧊 Giro 3D</button>
        <button style={isL ? (cineLeft ? styles.btnCineActivo : styles.btnCine) : (cineRight ? styles.btnCineActivo : styles.btnCine)} onClick={() => isL ? setCineLeft(!cineLeft) : setCineRight(!cineRight)}>
          {(isL ? cineLeft : cineRight) ? "⏸️ Pausa" : "▶️ Cine"}
        </button>
        
        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#94a3b8", fontSize: "11px", marginLeft: "2px", flexShrink: 0 }}>
           <span>{cineSpeed} FPS</span>
           <input type="range" min="1" max="60" value={cineSpeed} onChange={(e) => setCineSpeed(Number(e.target.value))} style={{ width: "40px", accentColor: "#8b5cf6" }} />
        </div>

        <div style={styles.divisor} />

        <button style={isL ? (infoLeft ? styles.btnInfoActivo : styles.btnInfo) : (infoRight ? styles.btnInfoActivo : styles.btnInfo)} onClick={() => isL ? setInfoLeft(!infoLeft) : setInfoRight(!infoRight)}>🛡️ Info</button>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#000", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "15px", flexShrink: 0 }}>
        <button onClick={onVolver} style={{ padding: "8px 16px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>← Cerrar Comparación</button>
        <h2 style={{ color: "#e2e8f0", margin: 0 }}>Comparación (Historial eFilm)</h2>
        <label style={{ color: "#fbbf24", fontWeight: "bold", cursor: "pointer", marginLeft: "20px" }}><input type="checkbox" checked={syncScroll} onChange={() => setSyncScroll(!syncScroll)} style={{ marginRight: "8px" }} />🔗 Sincronizar Scroll</label>
      </div>

      <div style={{ display: "flex", gap: "15px", flex: 1, minHeight: 0 }}>
        {/* PANEL IZQUIERDO */}
        <div 
          style={{ flex: 1, backgroundColor: "#0f172a", padding: "10px", borderRadius: "8px", display: "flex", flexDirection: "column", minWidth: 0 }}
          onMouseEnter={() => panelHover.current = 'L'}
        >
          {renderToolbar('L')}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 0", backgroundColor: "#1e293b", padding: "8px", borderRadius: "6px" }}>
             <button style={styles.btnTool} onClick={() => moverIzquierda(-1)}>◄</button>
             <input type="range" min="0" max={(urlsA?.length || 1) - 1} value={indexLeft} onChange={(e) => moverIzquierda(Number(e.target.value) - indexLeft)} style={{ flex: 1, cursor: "pointer", accentColor: "#fbbf24" }} />
             <button style={styles.btnTool} onClick={() => moverIzquierda(1)}>►</button>
          </div>
          <div ref={dicomLeftRef} style={styles.dicomBox} onContextMenu={e => e.preventDefault()} onWheel={e => moverIzquierda(e.deltaY > 0 ? 1 : -1)} onMouseDown={e => handleMouse('L', 'down', e)} onMouseMove={e => handleMouse('L', 'move', e)} onMouseUp={e => handleMouse('L', 'up', e)} onMouseLeave={e => handleMouse('L', 'up', e)}>
            <div style={styles.overlayText}>Corte {indexLeft + 1} / {urlsA?.length || 0}</div>
            {infoLeft && <div style={styles.overlayInfo}>Serie: {seriesA?.[serieLeft]?.nombre || 'N/A'}<br/>Imágenes: {urlsA?.length || 0}</div>}
          </div>
          {/* MINIATURAS IZQUIERDAS */}
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginTop: "10px", paddingBottom: "5px", scrollbarWidth: "thin" }}>
             {seriesA?.map((s, idx) => (
                <Thumb key={`L-${idx}`} url={s.urls[0]} count={s.urls.length} activo={serieLeft === idx} onClick={() => { setSerieLeft(idx); setIndexLeft(0); }} />
             ))}
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div 
          style={{ flex: 1, backgroundColor: "#0f172a", padding: "10px", borderRadius: "8px", display: "flex", flexDirection: "column", minWidth: 0 }}
          onMouseEnter={() => panelHover.current = 'R'}
        >
          {renderToolbar('R')}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "10px 0", backgroundColor: "#1e293b", padding: "8px", borderRadius: "6px" }}>
             <button style={styles.btnTool} onClick={() => moverDerecha(-1)}>◄</button>
             <input type="range" min="0" max={(urlsB?.length || 1) - 1} value={indexRight} onChange={(e) => moverDerecha(Number(e.target.value) - indexRight)} style={{ flex: 1, cursor: "pointer", accentColor: "#fbbf24" }} />
             <button style={styles.btnTool} onClick={() => moverDerecha(1)}>►</button>
          </div>
          <div ref={dicomRightRef} style={styles.dicomBox} onContextMenu={e => e.preventDefault()} onWheel={e => moverDerecha(e.deltaY > 0 ? 1 : -1)} onMouseDown={e => handleMouse('R', 'down', e)} onMouseMove={e => handleMouse('R', 'move', e)} onMouseUp={e => handleMouse('R', 'up', e)} onMouseLeave={e => handleMouse('R', 'up', e)}>
            <div style={styles.overlayText}>Corte {indexRight + 1} / {urlsB?.length || 0}</div>
            {infoRight && <div style={styles.overlayInfo}>Serie: {seriesB?.[serieRight]?.nombre || 'N/A'}<br/>Imágenes: {urlsB?.length || 0}</div>}
          </div>
          {/* MINIATURAS DERECHAS */}
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginTop: "10px", paddingBottom: "5px", scrollbarWidth: "thin" }}>
             {seriesB?.map((s, idx) => (
                <Thumb key={`R-${idx}`} url={s.urls[0]} count={s.urls.length} activo={serieRight === idx} onClick={() => { setSerieRight(idx); setIndexRight(0); }} />
             ))}
          </div>
        </div>

      </div>
    </div>
  );
}