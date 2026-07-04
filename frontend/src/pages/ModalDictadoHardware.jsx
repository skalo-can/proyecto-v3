import React, { useRef, useState } from "react";

export default function ModalDictadoHardware({
  isOpen,
  paciente,
  estaGrabando,
  volumenVoz,
  audioUrl,
  onPausarReanudar,
  onDescartar,
  onGuardar,
  onIniciar
}) {
  if (!isOpen || !paciente) return null;

  const audioRef = useRef(null);
  const [grabacionIniciada, setGrabacionIniciada] = useState(false);

const handleNavigate = (action) => {
    const a = audioRef.current;
    if (!a || !a.src) return; // Escudo 1: Si no hay origen de audio cargado, ignora el clic
    
    try {
      if (action === 'rewind') a.currentTime = Math.max(0, a.currentTime - 5);
      if (action === 'forward') a.currentTime = Math.min(a.duration, a.currentTime + 5);
      if (action === 'play') {
        // Escudo 2: Las promesas evitan el error rojo "Uncaught in promise"
        const playPromise = a.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => console.log("Audio empaquetándose, espera un segundo...", error));
        }
      }
      if (action === 'pause') a.pause();
      if (action === 'speed') a.playbackRate = a.playbackRate >= 2 ? 1 : a.playbackRate + 0.25;
    } catch (e) {
      console.warn("Navegación bloqueada preventivamente", e);
    }
  };

  // Estilos constantes
  const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 };
  const modalContent = { background: '#111418', border: '3px solid #fbbf24', borderRadius: '12px', padding: '40px', width: '700px', boxShadow: '0 0 40px rgba(251,191,36,0.2)' };
  const btnInicio = { background: '#10b981', color: '#fff', border: 'none', padding: '20px 40px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 'bold' };
  const btnControl = { background: '#1e293b', border: '1px solid #475569', color: '#fbbf24', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', margin: '5px' };
  const btnAccion = { background: '#334155', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const btnGuardar = { background: '#10b981', color: '#fff', border: 'none', padding: '15px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };

  return (
    <div style={modalOverlay}>
      <div style={modalContent}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: estaGrabando ? '#ef4444' : '#fbbf24' }} />
          <h3 style={{ color: '#fff', fontSize: '1.6rem', margin: 0 }}>
            {!grabacionIniciada ? "🎙️ LISTO PARA INICIAR" : (estaGrabando ? "🎤 MODO GRABACIÓN ACTIVO" : "⏸️ SESIÓN EN PAUSA")}
          </h3>
        </div>

        <div style={{ background: '#000', padding: '20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '30px' }}>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>{paciente.primer_apellido} {paciente.primer_nombre}</h4>
          <p style={{ margin: '8px 0 0 0', fontSize: '1.1rem', color: '#fbbf24', fontFamily: 'monospace' }}>ID: {paciente.identificacion} | Mod: {paciente.modalidad}</p>
        </div>

        <div style={{ background: '#07080a', padding: '40px', borderRadius: '12px', border: '2px dashed #444', marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          
          {!grabacionIniciada ? (
            <button style={btnInicio} onClick={() => { setGrabacionIniciada(true); if (typeof onIniciar === 'function') onIniciar(); }}>⏺️ INICIAR GRABACIÓN</button>
          ) : estaGrabando ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '60px' }}>
                {volumenVoz.map((h, i) => <div key={i} style={{ width: '8px', backgroundColor: '#ef4444', borderRadius: '4px', height: `${h + 10}px` }} />)}
              </div>
              <button style={btnAccion} onClick={onPausarReanudar}>⏸️ PAUSAR GRABACIÓN</button>
            </>
          ) : (
            <div style={{ width: '100%', textAlign: 'center' }}>
              <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', marginBottom: '15px' }} />
              <div style={{ marginBottom: '15px' }}>
                <button style={btnControl} onClick={() => handleNavigate('rewind')}>⏪ 5s</button>
                <button style={btnControl} onClick={() => handleNavigate('play')}>▶️ Play</button>
                <button style={btnControl} onClick={() => handleNavigate('pause')}>⏸️ Pausa</button>
                <button style={btnControl} onClick={() => handleNavigate('speed')}>⚡ Spd</button>
                <button style={btnControl} onClick={() => handleNavigate('forward')}>⏩ 5s</button>
              </div>
              <button style={btnInicio} onClick={onPausarReanudar}>▶️ CONTINUAR GRABACIÓN</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
          <button type="button" onClick={onDescartar} style={btnAccion}>DESCARTAR SESIÓN</button>
          <button type="button" onClick={onGuardar} style={btnGuardar}>FINALIZAR Y GUARDAR</button>
        </div>
      </div>
    </div>
  );
}