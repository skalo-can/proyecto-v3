import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ModalFirma() {
  const { estudioId } = useParams();
  const [reporteTexto, setReporteTexto] = useState("");
  const [nombreMedico, setNombreMedico] = useState("");
  const [registroMedico, setRegistroMedico] = useState("");
  const [estaGenerandoPdf, setEstaGenerandoPdf] = useState(false);

  // 🔄 1. Cargar la transcripción del paciente usando el parámetro URL
  useEffect(() => {
    if (estudioId) {
      console.log("📡 Solicitando informe para el estudio ID:", estudioId);
      
      fetch(`http://localhost:8000/api/pacientes/${estudioId}/obtener-transcripcion`)
        .then(res => res.json())
        .then(data => {
          console.log("📥 Datos recibidos del backend:", data);
          const textoFinal = data.informe || data.informe_texto || data.informe_text || data.texto || data.informe_final || "";
          setReporteTexto(textoFinal);
        })
        .catch(err => console.error("❌ Error en fetch de transcripción:", err));
    }
  }, [estudioId]);

  // ⌨️ 2. MOTOR DE ATAJOS CIEGOS PARA MONITORES DEDICADOS
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si presiona Ctrl + Enter firma directamente desde cualquier campo
      if (e.code === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleFirmar();
      }
      // Si presiona Escape cierra la ventana nativa
      if (e.code === 'Escape') {
        e.preventDefault();
        window.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reporteTexto, nombreMedico, registroMedico]); // Mantener el estado fresco

  // 🔏 3. EJECUCIÓN DE FIRMA Y ALIMENTACIÓN AL CANAL BROADCAST
  const handleFirmar = async () => {
    if (!nombreMedico.trim() || !registroMedico.trim()) {
      alert("⚠️ Debe ingresar su Nombre y Registro Médico para firmar el documento.");
      return;
    }

    setEstaGenerandoPdf(true);

    try {
      // 1️⃣ Guardar el informe definitivo y credenciales del profesional
      const responseGuardar = await fetch(`http://localhost:8000/api/pacientes/${estudioId}/firmar-informe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          informe_final: reporteTexto,
          medico_firma: nombreMedico,
          registro_medico: registroMedico
        })
      });

      if (!responseGuardar.ok) throw new Error("Error al estampar la firma.");

      // 2️⃣ Generar el PDF final en el almacenamiento estático del backend
      const responsePdf = await fetch(`http://localhost:8000/api/estudios/${estudioId}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🚀 AQUÍ ESTÁ LA INYECCIÓN EXACTA: Enviamos los datos directo al generador del PDF
        body: JSON.stringify({
          medico_firma: nombreMedico,
          registro_medico: registroMedico
        })
      });

      if (!responsePdf.ok) {
         console.warn("Problema al compilar el PDF físico.");
      }

      // 🚀 3️⃣ EMITIR SEÑAL DE ACTUALIZACIÓN AL MONITOR PRINCIPAL
      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();

      // Suicidio limpio de la ventana flotante
      window.close();
      
    } catch (error) {
      console.error("Error al firmar:", error);
      alert("❌ Hubo un fallo al conectar con la API.");
    } finally {
      setEstaGenerandoPdf(false);
    }
  };

  // 🎨 4. INTERFAZ ESTÉTICA MULTIMONITOR (Borde Verde Esmeralda)
  const layoutMultimonitor = { 
    width: '100vw', 
    height: '100vh', 
    background: '#07080a', 
    boxSizing: 'border-box',
    display: 'flex', 
    flexDirection: 'column', 
    padding: '30px',
    border: '8px solid #10b981', // Verde representativo del estado "Firmado"
    transition: 'all 0.3s ease'
  };

  const inputEstilo = { 
    flex: 1, 
    padding: "15px", 
    borderRadius: "6px", 
    border: "1px solid #334155", 
    backgroundColor: "#0f172a", 
    color: "#fff",
    fontSize: "1rem"
  };

  const kbdStyle = { 
    backgroundColor: "#1e293b", 
    border: "1px solid #475569", 
    borderRadius: "4px", 
    padding: "4px 8px", 
    color: "#fbbf24", 
    fontFamily: "monospace", 
    fontSize: "0.9rem", 
    boxShadow: "0 2px 0 #0f172a" 
  };

  return (
    <div style={layoutMultimonitor}>
      
      {/* CABECERA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", margin: 0, fontSize: "1.8rem", display: "flex", alignItems: "center", gap: "10px" }}>
          🔏 Estación de Validación y Firma Digital
        </h2>
      </div>

      {/* 🚀 PANEL VISUAL DE ATAJOS (CHEAT SHEET) */}
      <div style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.4)", borderRadius: "8px", padding: "15px 25px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "2.5rem" }}>⌨️</div>
        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#a7f3d0", fontSize: "1.1rem" }}>Guía Rápida de Operación</h4>
          <div style={{ display: "flex", gap: "30px", color: "#e2e8f0" }}>
            <span><kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>Enter</kbd> ➔ Estampar Firma y Cerrar</span>
            <span><kbd style={kbdStyle}>Esc</kbd> ➔ Cancelar y Salir</span>
          </div>
        </div>
      </div>

      {/* TEXTAREA IMPRESIÓN BLANCA SOLICITADA */}
      <textarea
        value={reporteTexto}
        onChange={(e) => setReporteTexto(e.target.value)}
        placeholder="Cargando reporte de transcripción..."
        style={{
          flex: 1, 
          padding: "30px", 
          backgroundColor: "#ffffff",
          color: "#0f172a",
          border: "2px solid #10b981",
          borderRadius: "8px",
          fontSize: "16px",
          lineHeight: "1.8",
          resize: "none", 
          marginBottom: "20px",
          overflowY: "auto"
        }}
      />

      {/* INFORMACIÓN DEL MÉDICO */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "25px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>Nombre del Radiólogo:</label>
          <input type="text" value={nombreMedico} onChange={(e) => setNombreMedico(e.target.value)} placeholder="Dr. / Dra. ..." style={inputEstilo} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>Registro Médico (RM):</label>
          <input type="text" value={registroMedico} onChange={(e) => setRegistroMedico(e.target.value)} placeholder="Ej. RM-99857" style={inputEstilo} />
        </div>
      </div>

      {/* BOTONERA PRINCIPAL */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px" }}>
        <button onClick={() => window.close()} style={{ padding: "12px 25px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }} disabled={estaGenerandoPdf}>
          Descartar Cambios
        </button>
        
        <button 
          onClick={handleFirmar} 
          disabled={estaGenerandoPdf}
          style={{ 
            padding: "12px 35px", 
            backgroundColor: estaGenerandoPdf ? "#4b5563" : "#10b981", 
            color: "white", 
            border: "none", 
            borderRadius: "6px", 
            fontWeight: "bold", 
            fontSize: "1.1rem",
            cursor: estaGenerandoPdf ? "not-allowed" : "pointer",
            boxShadow: estaGenerandoPdf ? "none" : "0 4px 15px rgba(16, 185, 129, 0.4)",
          }}
        >
          {estaGenerandoPdf ? "⏳ Generando Reporte PDF..." : "🔏 Confirmar y Firmar Documento"}
        </button>
      </div>

    </div>
  );
}