import React, { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAudioRecorder } from "./useAudioRecorder"; // 🚀 Importamos el hardware internamente

export default function ModalDictadoHardware({ isWindow }) {
  const { pacienteId } = useParams();
  const [paciente, setPaciente] = useState(null);
  const audioRef = useRef(null);
  const [grabacionIniciada, setGrabacionIniciada] = useState(false);

  // 1. Instanciamos el micrófono dentro de la ventana independiente
  const {
    estaGrabando,
    volumenVoz,
    audioUrl,
    audioBlobReal,
    iniciarGrabacionHardware,
    pausarGrabacionHardware,
    reanudarGrabacionHardware,
    detenerGrabacionHardware
  } = useAudioRecorder();

  // 2. Carga directa por ID para evitar que la pantalla se congele
  useEffect(() => {
    if (pacienteId) {
      fetch(`http://localhost:8000/api/pacientes/${pacienteId}`)
        .then(res => {
          if (!res.ok) throw new Error("Error en servidor");
          return res.json();
        })
        .then(data => {
          setPaciente(data);
        })
        .catch(err => console.error("Error al cargar datos del paciente", err));
    }
  }, [pacienteId]);

  // 3. Manejo de Navegación de Audio
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
    } catch (e) {
      console.warn("Navegación bloqueada", e);
    }
  };

  // 🚀 NUEVA LÓGICA: Rechazo Técnico por Calidad de Imagen
  const handleRechazoTecnico = async () => {
    const motivo = window.prompt("🚨 CONTROL DE CALIDAD PACS:\nEscriba el motivo detallado del rechazo de la imagen (Esta nota será visible para el tecnólogo):");
    
    if (!motivo) return; 

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${pacienteId}/rechazar-estudio-imagen`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nota_rechazo: motivo })
      });

      if (response.ok) {
        alert("🛑 Estudio rebotado a adquisición de imágenes con éxito.");
        
        // Refrescamos la tabla del panel principal
        const canalRefresco = new BroadcastChannel("mipacs_refresco_flujo");
        canalRefresco.postMessage("actualizar_tabla");
        canalRefresco.close();
        
        window.close(); // Cerramos el visor
      } else {
        alert("❌ No se pudo procesar el rechazo en el servidor.");
      }
    } catch (error) {
      console.error("Error al rechazar:", error);
      alert("❌ Error de comunicación con la API.");
    }
  };

  // 4. Lógica de Finalización y Descarte
  const onGuardar = async () => {
    if (!paciente) return;
    detenerGrabacionHardware(false);
    
    if (audioBlobReal) {
      const formData = new FormData();
      formData.append("audio", audioBlobReal, `dictado_${paciente.id}.wav`);
      
      try {
        await fetch(`http://localhost:8000/api/pacientes/${paciente.id}/guardar-audio`, {
          method: "POST",
          body: formData
        });
        
        const canal = new BroadcastChannel("mipacs_refresco_flujo");
        canal.postMessage("actualizar_tabla");
        canal.close();

        window.close(); 
      } catch (err) {
        alert("Error al enviar el audio al servidor.");
      }
    }
  };

  const onDescartar = () => {
    detenerGrabacionHardware(true);
    window.close(); 
  };

  const alternarPausaReanudar = () => {
    estaGrabando ? pausarGrabacionHardware() : reanudarGrabacionHardware();
  };

  // 5. ⌨️ MOTOR DE ATAJOS DE TECLADO CIEGOS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch(e.code) {
        case 'Space':
          e.preventDefault(); 
          if (!grabacionIniciada) {
            setGrabacionIniciada(true);
            iniciarGrabacionHardware();
          } else {
            alternarPausaReanudar();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (grabacionIniciada) onGuardar();
          break;
        case 'Escape':
          e.preventDefault();
          onDescartar();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate('rewind');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate('forward');
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleNavigate('speed_up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleNavigate('speed_down');
          break;
        case 'Tab':
          e.preventDefault();
          
          if (estaGrabando) {
            pausarGrabacionHardware();
          }
          
          if (audioRef.current) {
            if (audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            } else {
              audioRef.current.pause();
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [grabacionIniciada, estaGrabando, audioBlobReal, paciente]); 

  if (!paciente) return <div style={{ background: '#000', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}><h2>Cargando paciente...</h2></div>;

  // 🎨 ESTÉTICA MULTIMONITOR
  const getColorMarco = () => {
    if (!grabacionIniciada) return '15px solid #334155'; 
    if (estaGrabando) return '15px solid #ef4444'; 
    return '15px solid #eab308'; 
  };

  const kbdStyle = { backgroundColor: "#334155", border: "1px solid #475569", borderRadius: "4px", padding: "4px 8px", color: "#fbbf24", fontFamily: "monospace", fontSize: "0.9rem", boxShadow: "0 2px 0 #0f172a" };

  const layoutMultimonitor = { 
    width: '100vw', 
    height: '100vh', 
    background: '#07080a', 
    border: getColorMarco(), 
    boxSizing: 'border-box',
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: '40px',
    transition: 'border 0.2s ease-in-out' 
  };

  const btnInicio = { background: '#10b981', color: '#fff', border: 'none', padding: '20px 40px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 'bold' };
  const btnControl = { background: '#1e293b', border: '1px solid #475569', color: '#fbbf24', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', margin: '5px' };
  const btnAccion = { background: '#334155', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const btnGuardar = { background: '#10b981', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const btnRechazar = { background: '#ef4444', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }; // Nuevo botón

  return (
    <div style={layoutMultimonitor}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={{ 
          width: '30px', height: '30px', borderRadius: '50%', 
          backgroundColor: estaGrabando ? '#ef4444' : (grabacionIniciada ? '#eab308' : '#334155'),
          boxShadow: estaGrabando ? '0 0 20px #ef4444' : 'none'
        }} />
        <h1 style={{ color: '#fff', fontSize: '2rem', margin: 0 }}>
          {!grabacionIniciada ? "🎙️ ESPERANDO INICIO" : (estaGrabando ? "🎤 MODO GRABACIÓN ACTIVO" : "⏸️ GRABACIÓN PAUSADA")}
        </h1>
      </div>

      <div style={{ background: '#111418', padding: '30px', width: '100%', maxWidth: '700px', borderRadius: '8px', border: '1px solid #333', marginBottom: '30px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.8rem' }}>{paciente.primer_apellido} {paciente.primer_nombre}</h2>
        <p style={{ margin: '10px 0 0 0', fontSize: '1.2rem', color: '#fbbf24', fontFamily: 'monospace' }}>
          ID: {paciente.identificacion || paciente.id} | Modalidad: {paciente.modalidad || paciente.tipo_estudio}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {!grabacionIniciada ? (
          <>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button style={btnInicio} onClick={() => { setGrabacionIniciada(true); iniciarGrabacionHardware(); }}>
                ⏺️ INICIAR (Barra Espaciadora)
              </button>
              <button style={{...btnRechazar, padding: '20px 40px', fontSize: '1.2rem'}} onClick={handleRechazoTecnico} title="Rechazar estudio sin grabar">
                🛑 RECHAZAR IMAGEN
              </button>
            </div>
            
            <div style={{ backgroundColor: "rgba(251, 191, 36, 0.1)", border: "1px solid rgba(251, 191, 36, 0.4)", borderRadius: "8px", padding: "15px", marginTop: "15px", display: "flex", alignItems: "center", gap: "15px", justifyContent: "center" }}>
              <div style={{ fontSize: "2rem" }}>⌨️</div>
              <div>
                <h4 style={{ margin: "0 0 5px 0", color: "#fcd34d", fontSize: "1rem" }}>Controles Rápidos</h4>
                <div style={{ color: "#e2e8f0", fontSize: "0.9rem" }}>
                  Presiona <kbd style={kbdStyle}>Espacio</kbd> para Iniciar la grabación a ciegas.
                </div>
              </div>
            </div>
          </>
        ) : estaGrabando ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '80px', marginBottom: '20px' }}>
              {volumenVoz.map((h, i) => <div key={i} style={{ width: '12px', backgroundColor: '#ef4444', borderRadius: '4px', height: `${(h * 1.5) + 15}px`, transition: 'height 0.1s' }} />)}
            </div>
            <p style={{ color: '#94a3b8', fontFamily: 'monospace', margin: 0 }}>Usa la <kbd style={kbdStyle}>Barra Espaciadora</kbd> para Pausar</p>
          </>
        ) : (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', marginBottom: '15px' }} />
            <div style={{ marginBottom: '15px' }}>
              <button style={btnControl} onClick={() => handleNavigate('rewind')} title="Atajo: Flecha Izquierda">⏪ 5s</button>
              <button style={btnControl} onClick={() => handleNavigate('play')}>▶️ Play</button>
              <button style={btnControl} onClick={() => handleNavigate('pause')}>⏸️ Pausa</button>
              <button style={btnControl} onClick={() => handleNavigate('speed_up')} title="Atajo: Flecha Arriba">⚡ Spd (+)</button>
              <button style={btnControl} onClick={() => handleNavigate('speed_down')} title="Atajo: Flecha Abajo">🐢 Spd (-)</button>
              <button style={btnControl} onClick={() => handleNavigate('forward')} title="Atajo: Flecha Derecha">⏩ 5s</button>
            </div>
            
            <div style={{ backgroundColor: "rgba(251, 191, 36, 0.1)", border: "1px solid rgba(251, 191, 36, 0.4)", borderRadius: "8px", padding: "15px", marginTop: "25px", display: "flex", alignItems: "center", gap: "15px", justifyContent: "center", textAlign: 'left' }}>
              <div style={{ fontSize: "2rem" }}>⌨️</div>
              <div>
                <h4 style={{ margin: "0 0 5px 0", color: "#fcd34d", fontSize: "1rem" }}>Controles por Teclado</h4>
                <div style={{ display: "flex", gap: "20px", color: "#e2e8f0", fontSize: "0.9rem" }}>
                  <span><kbd style={kbdStyle}>Espacio</kbd> : Reanudar</span>
                  <span><kbd style={kbdStyle}>Tab</kbd> : Revisión Rápida (Escuchar)</span>
                  <span><kbd style={kbdStyle}>Enter</kbd> : Finalizar y Guardar</span>
                  <span><kbd style={kbdStyle}>Esc</kbd> : Descartar</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {grabacionIniciada && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', width: '100%', maxWidth: '700px', marginTop: '40px' }}>
          <button type="button" onClick={onDescartar} style={btnAccion}>❌ DESCARTAR (Esc)</button>
          <button type="button" onClick={handleRechazoTecnico} style={btnRechazar} title="Detener y devolver estudio">🛑 RECHAZAR IMAGEN</button>
          <button type="button" onClick={onGuardar} style={btnGuardar}>✅ FINALIZAR (Enter)</button>
        </div>
      )}
    </div>
  );
}