import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

export default function ModalTranscriptor({ isWindow }) {
  const { estudioId } = useParams();
  const [texto, setTexto] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [paciente, setPaciente] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (estudioId) {
      setAudioUrl(`http://localhost:8000/api/pacientes/${estudioId}/audio?t=${new Date().getTime()}`);
      fetch(`http://localhost:8000/api/pacientes?busqueda=${estudioId}`)
        .then(res => res.json())
        .then(data => {
           const p = Array.isArray(data) ? data.find(x => x.id == estudioId) : data.items?.find(x => x.id == estudioId);
           setPaciente(p);
        })
        .catch(err => console.error("Error al cargar datos del paciente", err));
    }
  }, [estudioId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey) {
        if (e.code === 'Space') {
          e.preventDefault(); 
          if (audioRef.current) {
            audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
          }
        }
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (audioRef.current) audioRef.current.currentTime -= 5;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (audioRef.current) audioRef.current.currentTime += 5;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGuardar = async () => {
    if (!texto.trim()) {
      alert("⚠️ Por favor, escriba la transcripción antes de guardar.");
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${estudioId}/guardar-transcripcion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ informe: texto }),
      });
      if (!response.ok) throw new Error("Error en el servidor");
      if (!response.ok) throw new Error("Error en el servidor");

      // 🚀 AVISAR AL MONITOR PRINCIPAL ANTES DE CERRAR
      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();

      window.close();
      window.close(); 
    } catch (error) {
      alert("❌ Hubo un fallo al conectar con la API.");
    }
  };

  // 🎨 ESTILOS MULTIMONITOR Y TECLAS
  const layoutMultimonitor = { width: '100vw', height: '100vh', background: '#07080a', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '30px', border: '8px solid #8b5cf6' };
  const btnEstilo = { padding: "12px 25px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", border: "none" };
  const kbdStyle = { backgroundColor: "#334155", border: "1px solid #475569", borderRadius: "4px", padding: "4px 8px", color: "#fbbf24", fontFamily: "monospace", fontSize: "0.9rem", boxShadow: "0 2px 0 #0f172a" };

  return (
    <div style={layoutMultimonitor}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", margin: 0, fontSize: "1.8rem" }}>✍️ Estación de Transcripción</h2>
        {paciente && (
          <div style={{ textAlign: "right" }}>
            <h3 style={{ margin: 0, color: "#fff" }}>{paciente.primer_apellido} {paciente.primer_nombre}</h3>
            <span style={{ color: "#8b5cf6", fontFamily: "monospace" }}>ID: {paciente.identificacion || paciente.id}</span>
          </div>
        )}
      </div>

      {/* 🚀 PANEL VISUAL DE ATAJOS (CHEAT SHEET) */}
      <div style={{ backgroundColor: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "8px", padding: "15px 25px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "2.5rem" }}>⌨️</div>
        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#c4b5fd", fontSize: "1.1rem" }}>Guía Rápida de Atajos (No sueltes el teclado al escribir)</h4>
          <div style={{ display: "flex", gap: "30px", color: "#e2e8f0" }}>
            <span><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Espacio</kbd> ➔ Pausar / Reproducir</span>
            <span><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>⬅️</kbd> <kbd style={kbdStyle}>➡️</kbd> ➔ Atrasar / Adelantar 5s</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "15px", backgroundColor: "#111418", borderRadius: "8px", border: "1px solid #333", marginBottom: "20px", display: "flex", gap: "20px", alignItems: "center" }}>
        <audio ref={audioRef} src={audioUrl} controls style={{ flex: 1 }} />
        <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.0)} style={{ ...btnEstilo, background: "#1e293b", color: "#fbbf24", border: "1px solid #475569" }}>1.0x Normal</button>
        <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.5)} style={{ ...btnEstilo, background: "#1e293b", color: "#fbbf24", border: "1px solid #475569" }}>1.5x Rápido</button>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Comience a transcribir el dictado aquí..."
        style={{ flex: 1, padding: "30px", backgroundColor: "#ffffff", color: "#0f172a", border: "2px solid #8b5cf6", borderRadius: "8px", fontSize: "16px", lineHeight: "1.8", resize: "none", marginBottom: "20px" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setTexto("ESTUDIO RADIOLÓGICO NORMAL:\n\nNo se observan alteraciones pleuropulmonares ni cardiovasculares agudas.\nEstructuras óseas sin lesiones aparentes.\nImpresión Diagnóstica: Estudio dentro de límites normales.")} style={{ ...btnEstilo, backgroundColor: "#f59e0b", color: "#fff" }}>📄 Cargar Plantilla Normal</button>
        <div style={{ display: "flex", gap: "15px" }}>
          <button onClick={() => window.close()} style={{ ...btnEstilo, backgroundColor: "#334155", color: "#fff" }}>❌ Descartar Cambios</button>
          <button onClick={handleGuardar} style={{ ...btnEstilo, backgroundColor: "#10b981", color: "#fff" }}>✅ Guardar Transcripción</button>
        </div>
      </div>
    </div>
  );
}