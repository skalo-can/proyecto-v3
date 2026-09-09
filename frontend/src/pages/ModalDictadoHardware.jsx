import React, { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAudioRecorder } from "./useAudioRecorder"; 

export default function ModalDictadoHardware({ isWindow, estudioIdProps }) {
  const { pacienteId } = useParams();
  
  const estudioId = estudioIdProps || pacienteId; 
  
  const [paciente, setPaciente] = useState(null);
  const audioRef = useRef(null);
  const [grabacionIniciada, setGrabacionIniciada] = useState(false);
  const [procesandoGuardado, setProcesandoGuardado] = useState(false);

  const {
    estaGrabando, volumenVoz, audioUrl, audioBlobReal,
    iniciarGrabacionHardware, pausarGrabacionHardware,
    reanudarGrabacionHardware, detenerGrabacionHardware
  } = useAudioRecorder();

  const apiBase = window.location.origin.includes(":5173") 
    ? "http://192.168.5.21:8000" 
    : window.location.origin;

  useEffect(() => {
    if (estudioId) {
      fetch(`${apiBase}/api/pacientes`)
        .then(res => {
          if (!res.ok) throw new Error("Error en servidor");
          return res.json();
        })
        .then(data => {
          const list = Array.isArray(data) ? data : (data.items || []);
          const p = list.find(x => String(x.estudio_interno_id) === String(estudioId));
          setPaciente(p);
        })
        .catch(err => console.error("Error al cargar datos del estudio", err));
    }
  }, [estudioId, apiBase]);

  const handleNavigate = (action) => {
    const a = audioRef.current;
    if (!a || !a.src) return; 
    try {
      if (action === 'rewind') a.currentTime = Math.max(0, a.currentTime - 5);
      if (action === 'forward') a.currentTime = Math.min(a.duration, a.currentTime + 5);
      if (action === 'play') {
        const playPromise = a.play();
        if (playPromise !== undefined) playPromise.catch(() => {});
      }
      if (action === 'pause') a.pause();
      if (action === 'speed_up') a.playbackRate = Math.min(2.0, a.playbackRate + 0.25);
      if (action === 'speed_down') a.playbackRate = Math.max(0.5, a.playbackRate - 0.25);
    } catch (e) { console.warn("Navegación bloqueada", e); }
  };

  const handleRechazoTecnico = async () => {
    const motivo = window.prompt("🚨 CONTROL DE CALIDAD PACS:\nEscriba el motivo detallado del rechazo:");
    if (!motivo) return; 
    try {
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/rechazar-estudio-imagen`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota_rechazo: motivo })
      });
      if (response.ok) {
        alert("🛑 Estudio rebotado con éxito.");
        const canalRefresco = new BroadcastChannel("mipacs_refresco_flujo");
        canalRefresco.postMessage("actualizar_tabla");
        setTimeout(() => { canalRefresco.close(); if(isWindow) window.close(); }, 150);
      } else { alert("❌ Fallo en servidor."); }
    } catch (error) { alert("❌ Error de comunicación."); }
  };

  const procesarEnvioServidor = async (blobFinal) => {
    if (!paciente) return;
    const formData = new FormData();
    const cedula_real = paciente.identificacion || paciente.id; 
    formData.append("audio", blobFinal, `dictado_${cedula_real}.wav`);
    
    try {
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/guardar-audio`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        const errorTexto = await response.text();
        alert(`❌ ALERTA DE BACKEND (No se guardó el audio):\nCódigo: ${response.status}\nDetalle: ${errorTexto}`);
        setProcesandoGuardado(false);
        return; 
      }
      
      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      setTimeout(() => { canal.close(); if(isWindow) window.close(); }, 150);
      if (!isWindow) alert("✅ Audio guardado exitosamente.");

    } catch (err) {
      alert(`❌ ERROR DE RED O CORS:\nFallo al contactar la API.\nDetalle: ${err.message}`);
      setProcesandoGuardado(false);
    }
  };

  const onGuardar = () => {
    if (!paciente || procesandoGuardado) return;
    
    if (estaGrabando) {
      setProcesandoGuardado(true);
      detenerGrabacionHardware(false); 
    } else if (audioBlobReal) {
      setProcesandoGuardado(true);
      procesarEnvioServidor(audioBlobReal);
    } else {
      alert("⚠️ No se ha detectado audio. Grabe algo antes de finalizar.");
    }
  };

  useEffect(() => {
    if (procesandoGuardado && audioBlobReal) {
      procesarEnvioServidor(audioBlobReal);
    }
  }, [audioBlobReal, procesandoGuardado]);

  const onDescartar = () => { detenerGrabacionHardware(true); if(isWindow) window.close(); };
  const alternarPausaReanudar = () => { estaGrabando ? pausarGrabacionHardware() : reanudarGrabacionHardware(); };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch(e.code) {
        case 'Space':
          e.preventDefault(); 
          if (!grabacionIniciada) { setGrabacionIniciada(true); iniciarGrabacionHardware(); } 
          else { alternarPausaReanudar(); }
          break;
        case 'Enter':
          e.preventDefault();
          if (grabacionIniciada && !procesandoGuardado) onGuardar();
          break;
        case 'Escape': e.preventDefault(); onDescartar(); break;
        case 'ArrowLeft': e.preventDefault(); handleNavigate('rewind'); break;
        case 'ArrowRight': e.preventDefault(); handleNavigate('forward'); break;
        case 'ArrowUp': e.preventDefault(); handleNavigate('speed_up'); break;
        case 'ArrowDown': e.preventDefault(); handleNavigate('speed_down'); break;
        case 'Tab':
          e.preventDefault();
          if (estaGrabando) pausarGrabacionHardware();
          if (audioRef.current) { audioRef.current.paused ? audioRef.current.play().catch(()=>{}) : audioRef.current.pause(); }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [grabacionIniciada, estaGrabando, audioBlobReal, paciente, procesandoGuardado]); 

  if (!paciente) return <div style={{ background: '#000', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}><h2>Preparando Grabadora...</h2></div>;

  const getColorMarco = () => {
    if (!grabacionIniciada) return isWindow ? '15px solid #334155' : '4px solid #334155'; 
    if (estaGrabando) return isWindow ? '15px solid #ef4444' : '4px solid #ef4444'; 
    return isWindow ? '15px solid #eab308' : '4px solid #eab308'; 
  };

  const nombreCompleto = [
    paciente.primer_apellido, 
    paciente.segundo_apellido, 
    paciente.primer_nombre, 
    paciente.segundo_nombre
  ].filter(Boolean).join(" ");

  const kbdStyle = { backgroundColor: "#334155", border: "1px solid #475569", borderRadius: "4px", padding: isWindow ? "4px 8px" : "2px 6px", color: "#fbbf24", fontFamily: "monospace", fontSize: isWindow ? "0.9rem" : "0.75rem", boxShadow: "0 2px 0 #0f172a", marginRight: "4px" };
  
  const layoutMultimonitor = { 
    width: '100%', height: '100%', background: '#07080a', border: getColorMarco(), boxSizing: 'border-box', 
    display: 'flex', flexDirection: 'column', justifyContent: isWindow ? 'center' : 'flex-start', 
    alignItems: 'center', padding: isWindow ? '40px' : '5px 15px', transition: 'border 0.2s ease-in-out', overflowY: 'auto'
  };
  
  const btnInicio = { background: '#10b981', color: '#fff', border: 'none', padding: isWindow ? '20px 40px' : '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: isWindow ? '1.4rem' : '1rem', fontWeight: 'bold' };
  const btnControl = { background: '#1e293b', border: '1px solid #475569', color: '#fbbf24', padding: isWindow ? '10px 15px' : '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', margin: '3px', fontSize: isWindow ? '1rem' : '0.8rem' };
  const btnAccion = { background: '#334155', color: '#fff', border: 'none', padding: isWindow ? '15px 30px' : '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: isWindow ? '1rem' : '0.85rem' };
  const btnGuardar = { background: '#10b981', color: '#fff', border: 'none', padding: isWindow ? '15px 30px' : '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: isWindow ? '1rem' : '0.85rem' };
  const btnRechazar = { background: '#ef4444', color: '#fff', border: 'none', padding: isWindow ? '15px 30px' : '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: isWindow ? '1rem' : '0.85rem' };

  // 🚀 BARRA DE ATAJOS PERMANENTE Y COMPACTA
  const barraAtajos = (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: isWindow ? "15px" : "10px", color: "#94a3b8", fontSize: isWindow ? "0.9rem" : "0.75rem", marginTop: isWindow ? "20px" : "8px", backgroundColor: "rgba(15, 23, 42, 0.6)", padding: "4px 12px", borderRadius: "6px", border: "1px solid #334155" }}>
      <span><kbd style={kbdStyle}>Espacio</kbd> Iniciar/Pausar</span>
      <span><kbd style={kbdStyle}>Tab</kbd> Reproducir Audio</span>
      <span><kbd style={kbdStyle}>Flechas</kbd> Adelantar/Atrasar</span>
      <span><kbd style={kbdStyle}>Enter</kbd> Finalizar</span>
      <span><kbd style={kbdStyle}>Esc</kbd> Descartar</span>
    </div>
  );

  return (
    <div style={layoutMultimonitor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: isWindow ? '30px' : '5px' }}>
        <div style={{ width: isWindow ? '30px' : '20px', height: isWindow ? '30px' : '20px', borderRadius: '50%', backgroundColor: estaGrabando ? '#ef4444' : (grabacionIniciada ? '#eab308' : '#334155'), boxShadow: estaGrabando ? '0 0 20px #ef4444' : 'none' }} />
        <h1 style={{ color: '#fff', fontSize: isWindow ? '2rem' : '1.1rem', margin: 0 }}>
          {!grabacionIniciada ? "🎙️ ESPERANDO INICIO" : (estaGrabando ? "🎤 MODO GRABACIÓN ACTIVO" : "⏸️ GRABACIÓN PAUSADA")}
        </h1>
      </div>

      <div style={{ background: '#111418', padding: isWindow ? '30px' : '8px', width: '100%', maxWidth: '700px', borderRadius: '8px', border: '1px solid #333', marginBottom: isWindow ? '30px' : '5px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: isWindow ? '1.8rem' : '1.1rem', textTransform: 'uppercase' }}>
          {nombreCompleto}
        </h2>
        <p style={{ margin: '2px 0 0 0', fontSize: isWindow ? '1.2rem' : '0.85rem', color: '#fbbf24', fontFamily: 'monospace' }}>
          ID: {paciente.identificacion || paciente.id} | Modalidad: {paciente.modalidad || paciente.tipo_estudio}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isWindow ? '20px' : '5px' }}>
        {!grabacionIniciada ? (
          <div style={{ display: 'flex', gap: '15px', marginTop: isWindow ? '0' : '5px' }}>
            <button style={btnInicio} onClick={() => { setGrabacionIniciada(true); iniciarGrabacionHardware(); }}>⏺️ INICIAR</button>
            <button style={btnRechazar} onClick={handleRechazoTecnico} title="Rechazar estudio sin grabar">🛑 RECHAZAR</button>
          </div>
        ) : estaGrabando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: isWindow ? '80px' : '35px', marginBottom: '5px' }}>
            {(volumenVoz || []).map((h, i) => <div key={i} style={{ width: isWindow ? '12px' : '8px', backgroundColor: '#ef4444', borderRadius: '4px', height: `${(h * 1.5) + (isWindow ? 15 : 10)}px`, transition: 'height 0.1s' }} />)}
          </div>
        ) : (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', height: isWindow ? '54px' : '35px', marginBottom: isWindow ? '15px' : '5px' }} />
            {!isWindow && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button style={btnControl} onClick={() => handleNavigate('rewind')}>⏪</button>
                <button style={btnControl} onClick={() => handleNavigate('play')}>▶️</button>
                <button style={btnControl} onClick={() => handleNavigate('pause')}>⏸️</button>
                <button style={btnControl} onClick={() => handleNavigate('forward')}>⏩</button>
              </div>
            )}
            {isWindow && (
              <div style={{ marginBottom: '10px' }}>
                <button style={btnControl} onClick={() => handleNavigate('rewind')}>⏪ 5s</button>
                <button style={btnControl} onClick={() => handleNavigate('play')}>▶️ Play</button>
                <button style={btnControl} onClick={() => handleNavigate('pause')}>⏸️ Pausa</button>
                <button style={btnControl} onClick={() => handleNavigate('speed_up')}>⚡ Spd (+)</button>
                <button style={btnControl} onClick={() => handleNavigate('speed_down')}>🐢 Spd (-)</button>
                <button style={btnControl} onClick={() => handleNavigate('forward')}>⏩ 5s</button>
              </div>
            )}
          </div>
        )}
      </div>

      {grabacionIniciada && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', width: '100%', maxWidth: '700px', marginTop: isWindow ? '40px' : '5px' }}>
          <button type="button" onClick={onDescartar} style={btnAccion}>❌ DESCARTAR</button>
          {!estaGrabando && <button type="button" onClick={onGuardar} style={btnGuardar}>✅ FINALIZAR</button>}
        </div>
      )}

      {barraAtajos}
    </div>
  );
}