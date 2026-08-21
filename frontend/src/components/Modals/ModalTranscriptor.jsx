import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

export default function ModalTranscriptor({ isWindow }) {
  const { estudioId } = useParams();
  const [texto, setTexto] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [paciente, setPaciente] = useState(null);
  
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");
  
  const [medicos, setMedicos] = useState([]);
  const [medicoSeleccionado, setMedicoSeleccionado] = useState("");
  
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const audioRef = useRef(null);

  // 🔥 RUTA DINÁMICA: Detecta si estamos en desarrollo o en la red del hospital
  const apiBase = window.location.origin.includes(":5173") 
    ? "http://192.168.5.21:8000" 
    : window.location.origin;

  // 🔄 CARGA INICIAL PROTEGIDA Y SEGURA
  useEffect(() => {
    if (estudioId) {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const headers = { "Authorization": `Bearer ${token}` };

      // 1. Descargar el audio enviando el Token de Seguridad (Para evitar 401)
      fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/audio?t=${new Date().getTime()}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Audio no disponible o sin autorización");
        return res.blob(); 
      })
      .then(blob => {
        const audioBlobUrl = URL.createObjectURL(blob);
        setAudioUrl(audioBlobUrl);
      })
      .catch(err => console.warn("Aviso de Audio:", err.message));

      // 2. Cargar datos de cabecera apuntando a tu endpoint original
      fetch(`${apiBase}/api/pacientes`, { headers })
        .then(res => res.json())
        .then(data => {
           const list = Array.isArray(data) ? data : (data.items || []);
           const p = list.find(x => String(x.estudio_interno_id) === String(estudioId));
           setPaciente(p);
        })
        .catch(err => console.error("Error al cargar datos del estudio", err));
    }
  }, [estudioId, apiBase]);

  // 🔥 EFECTO DE CARGA MULTIPLE (Plantillas + Médicos)
  useEffect(() => {
    const fetchDatosInit = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const headers = { "Authorization": `Bearer ${token}` };

        const resPlantillas = await fetch(`${apiBase}/api/plantillas`, { headers });
        if (resPlantillas.ok) {
          const dataPlantillas = await resPlantillas.json();
          setPlantillas(dataPlantillas);
        }
        
        const resMedicos = await fetch(`${apiBase}/api/usuarios`, { headers });
        if (resMedicos.ok) {
          const dataMedicos = await resMedicos.json();
          const radiologos = dataMedicos.filter(u => u.rol && u.rol.toLowerCase().includes('radiologo'));
          setMedicos(radiologos);
        }
      } catch (error) {
        console.error("Error cargando datos para el modal:", error);
      }
    };
    fetchDatosInit();
  }, [apiBase]);

  const plantillasFiltradas = plantillas.filter(p => {
    if (!p.medico_id) return true;
    if (medicoSeleccionado && p.medico_id === parseInt(medicoSeleccionado)) return true;
    return false;
  });

  // ⌨️ MOTOR DE ATAJOS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.ctrlKey && document.activeElement.tagName === 'AUDIO') {
        e.preventDefault();
      }
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault(); 
        if (audioRef.current) {
          audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
        }
      }
      if (e.altKey && e.code === 'ArrowLeft') {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime -= 5;
      }
      if (e.altKey && e.code === 'ArrowRight') {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime += 5;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
  
  const inyectarPlantilla = (e) => {
    const idPlantilla = e.target.value;
    if (!idPlantilla) {
      setPlantillaSeleccionada("");
      return;
    }
    const plantillaEncontrada = plantillas.find(p => p.id === parseInt(idPlantilla));
    if (plantillaEncontrada) {
      setTexto(prev => prev ? `${prev}\n\n${plantillaEncontrada.contenido}` : plantillaEncontrada.contenido);
    }
    setPlantillaSeleccionada("");
  };

  const handleAutoTranscribir = async () => {
    setIsTranscribing(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || ""; 

      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/transcribir-audio`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}` 
        }
      });
      
      if (!response.ok) throw new Error("No se pudo transcribir el audio.");
      
      const data = await response.json();
      
      if (data.texto) {
        setTexto(prev => prev ? `${prev}\n\n[TRANSCRIPCIÓN IA]: ${data.texto}` : data.texto);
      }
    } catch (error) {
      alert("❌ " + error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleGuardar = async () => {
    if (!texto.trim()) {
      alert("⚠️ Por favor, escriba la transcripción antes de guardar.");
      return;
    }
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || ""; 

      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/guardar-transcripcion`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ informe: texto }),
      });
      
      if (!response.ok) throw new Error("Error en el servidor");

      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();

      window.close(); 
    } catch (error) {
      console.error(error);
      alert("❌ Hubo un fallo al conectar con la API.");
    }
  };

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

      <div style={{ backgroundColor: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "8px", padding: "15px 25px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "2.5rem" }}>⌨️</div>
        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#c4b5fd", fontSize: "1.1rem" }}>Guía Rápida de Atajos (No sueltes el teclado al escribir)</h4>
          <div style={{ display: "flex", gap: "30px", color: "#e2e8f0" }}>
            <span><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Espacio</kbd> ➔ Pausar / Reproducir</span>
            <span><kbd style={kbdStyle}>Alt</kbd> + <kbd style={kbdStyle}>⬅️</kbd> <kbd style={kbdStyle}>➡️</kbd> ➔ Atrasar / Adelantar 5s</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "15px", backgroundColor: "#111418", borderRadius: "8px", border: "1px solid #333", marginBottom: "20px", display: "flex", gap: "20px", alignItems: "center" }}>
        {/* 🔥 REPRODUCTOR FÍSICO OCULTO (Bypass estricto para Safari y streaming 206) */}
        <audio ref={audioRef} style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} controls preload="auto" />
        
        {/* Botón manual de Play/Pausa visible para el transcriptor */}
        <button 
          onClick={() => {
            const a = audioRef.current;
            if (!a) return;
            if (a.paused) {
              if (audioUrl && !a.src) a.src = audioUrl;
              a.play().catch(() => alert("❌ Safari bloqueó la reproducción. Haz clic en la página primero."));
            } else {
              a.pause();
            }
          }}
          style={{ ...btnEstilo, background: "#3b82f6", color: "#fff" }}
        >
          ▶️ Play / Pausa
        </button>
        
        <button 
          onClick={handleAutoTranscribir} 
          disabled={isTranscribing}
          style={{ ...btnEstilo, background: isTranscribing ? "#475569" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 15px rgba(139, 92, 246, 0.4)" }}
        >
          {isTranscribing ? "⏳ Analizando audio..." : "🪄 Auto-Transcribir (IA)"}
        </button>
        
        <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.0)} style={{ ...btnEstilo, background: "#1e293b", color: "#fbbf24", border: "1px solid #475569" }}>1.0x Normal</button>
        <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.5)} style={{ ...btnEstilo, background: "#1e293b", color: "#fbbf24", border: "1px solid #475569" }}>1.5x Rápido</button>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Comience a transcribir el dictado aquí o pulse Auto-Transcribir..."
        style={{ flex: 1, padding: "30px", backgroundColor: "#ffffff", color: "#0f172a", border: "2px solid #8b5cf6", borderRadius: "8px", fontSize: "16px", lineHeight: "1.8", resize: "none", marginBottom: "20px" }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        
        <div style={{ display: "flex", gap: "15px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#1e293b", padding: "10px 15px", borderRadius: "6px", border: "1px solid #475569" }}>
            <span style={{ color: "#38bdf8", fontWeight: "bold", whiteSpace: "nowrap" }}>👨‍⚕️ Dictado por:</span>
            <select 
              value={medicoSeleccionado}
              onChange={(e) => setMedicoSeleccionado(e.target.value)}
              style={{ padding: "8px 12px", backgroundColor: "#0f172a", color: "#fff", border: "1px solid #64748b", borderRadius: "4px", outline: "none", cursor: "pointer" }}
            >
              <option value="">-- Seleccione Doctor --</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>
                  Dr(a). {m.nombre_completo || m.username}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#1e293b", padding: "10px 15px", borderRadius: "6px", border: "1px solid #475569" }}>
            <span style={{ color: "#fbbf24", fontWeight: "bold", whiteSpace: "nowrap" }}>📋 Insertar:</span>
            <select 
              value={plantillaSeleccionada}
              onChange={inyectarPlantilla}
              style={{ padding: "8px 12px", backgroundColor: "#0f172a", color: "#fff", border: "1px solid #64748b", borderRadius: "4px", minWidth: "250px", outline: "none", cursor: "pointer" }}
            >
              <option value="">-- Seleccione una plantilla --</option>
              {plantillasFiltradas.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.modalidad}] - {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px" }}>
          <button onClick={() => window.close()} style={{ ...btnEstilo, backgroundColor: "#334155", color: "#fff" }}>❌ Descartar Cambios</button>
          <button onClick={handleGuardar} style={{ ...btnEstilo, backgroundColor: "#10b981", color: "#fff" }}>✅ Guardar Transcripción</button>
        </div>
      </div>
    </div>
  );
}