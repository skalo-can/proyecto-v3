import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next"; // 🔥 Conectamos con tu sistema global

export default function ModalFirma() {
  const { estudioId } = useParams();
  const { i18n } = useTranslation(); 
  
  // 🔥 Detectamos el idioma actual en tiempo real
  const isEn = i18n.language?.startsWith('en');

  const [reporteTexto, setReporteTexto] = useState("");
  const [nombreMedico, setNombreMedico] = useState("");
  const [registroMedico, setRegistroMedico] = useState("");
  const [estaGenerandoPdf, setEstaGenerandoPdf] = useState(false);
  
  const [aprobado, setAprobado] = useState(null); 
  const [notaRechazo, setNotaRechazo] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  const [datosMedicoLogueado, setDatosMedicoLogueado] = useState({ nombre: "", rm: "" });

  const apiBase = window.location.origin.includes(":5173") 
    ? "http://192.168.5.21:8000" 
    : window.location.origin;

  useEffect(() => {
    let nombreFinal = "";
    let rmFinal = "";
    const usuarioGuardado = localStorage.getItem("usuario") || localStorage.getItem("user");
    
    if (usuarioGuardado) {
      try {
        const usuarioObj = JSON.parse(usuarioGuardado);
        nombreFinal = `${usuarioObj.primer_nombre || ""} ${usuarioObj.primer_apellido || ""}`.trim() || usuarioObj.nombre || usuarioObj.nombre_completo || "";
        rmFinal = usuarioObj.registro_medico || usuarioObj.rm || usuarioObj.registro || usuarioObj.matricula || "";
      } catch (error) {
        console.warn("No se pudo analizar el objeto:", error);
      }
    }
    setDatosMedicoLogueado({ nombre: nombreFinal, rm: rmFinal });

    if (estudioId) {
      fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/obtener-transcripcion`)
        .then(res => res.json())
        .then(data => {
          const textoFinal = data.informe || data.informe_texto || data.informe_text || data.texto || data.informe_final || "";
          setReporteTexto(textoFinal);
        })
        .catch(err => console.error("Error en fetch de transcripción:", err));
    }
  }, [estudioId, apiBase]);

  const handleSeleccionAprobacion = (decision) => {
    setAprobado(decision);
    if (decision === true) {
      setNombreMedico(datosMedicoLogueado.nombre);
      setRegistroMedico(datosMedicoLogueado.rm);
    } else {
      setNombreMedico("");
      setRegistroMedico("");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        if (aprobado !== null) handleProcesarFirma();
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        window.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reporteTexto, nombreMedico, registroMedico, aprobado, notaRechazo]);

  const handleProcesarFirma = async () => {
    if (aprobado === false && !notaRechazo.trim()) {
      alert(isEn ? "⚠️ You must enter a brief explanation note to return the report." : "⚠️ Debe ingresar una nota de explicación breve para devolver el informe.");
      return;
    }
    setEstaGenerandoPdf(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const notaFirma = isEn ? `\n\n[MEDICAL CORRECTION NOTE: ${notaRechazo}]` : `\n\n[NOTA DE CORRECCIÓN MÉDICA: ${notaRechazo}]`;

      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/firmar-informe`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": tokenSesion ? `Bearer ${tokenSesion}` : "" 
        },
        body: JSON.stringify({
          informe_final: aprobado ? reporteTexto : (reporteTexto + notaFirma),
          medico_firma: nombreMedico,
          registro_medico: registroMedico,
          aprobado: aprobado,
          nota_rechazo: notaRechazo
        })
      });

      if (!response.ok) throw new Error("Fallo en backend.");
      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();
      window.close();
      
    } catch (error) {
      alert(isEn ? "❌ Failed to connect to the API." : "❌ Hubo un fallo al conectar con la API.");
    } finally {
      setEstaGenerandoPdf(false);
    }
  };

  const handleConsultarIA = async () => {
    setCargandoIA(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      
      // 🔥 Le pasamos el parámetro de idioma a FastAPI para que Gemini responda en el idioma correcto
      const idiomaQuery = isEn ? "en" : "es";
      
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/asistencia-ia?lang=${idiomaQuery}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": tokenSesion ? `Bearer ${tokenSesion}` : ""
        },
        body: JSON.stringify({ texto_actual: reporteTexto }) 
      });

      if (!response.ok) throw new Error("Fallo de conexión con la IA");
      const data = await response.json();
      setReporteTexto(prev => prev + `\n\n${data.sugerencia}`);
      
    } catch (error) {
      alert(isEn ? `❌ Error invoking AI: ${error.message}` : `❌ Error al invocar la IA: ${error.message}`);
    } finally {
      setCargandoIA(false);
    }
  };

  const obtenerColorBorde = () => {
    if (aprobado === true) return '#10b981'; 
    if (aprobado === false) return '#ef4444'; 
    return '#334155'; 
  };

  const inputEstilo = { 
    flex: 1, padding: "15px", borderRadius: "6px", border: "1px solid #334155", 
    backgroundColor: "#0f172a", color: "#fff", fontSize: "1rem", transition: "all 0.3s"
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#07080a', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '30px', border: `8px solid ${obtenerColorBorde()}`, transition: 'all 0.3s ease', overflowY: 'auto' }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", margin: 0, fontSize: "1.8rem", display: "flex", alignItems: "center", gap: "10px" }}>
          🔏 {isEn ? "Validation and Digital Signature Station" : "Estación de Validación y Firma Digital"}
        </h2>
        <button onClick={handleConsultarIA} disabled={cargandoIA || estaGenerandoPdf} style={{ padding: "10px 20px", backgroundColor: "#7c3aed", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: cargandoIA ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)", display: "flex", alignItems: "center", gap: "8px" }}>
          {cargandoIA 
            ? (isEn ? "⏳ Processing Network..." : "⏳ Procesando Red...") 
            : (isEn ? "🤖 Request AI Assistance" : "🤖 Solicitar Asistencia IA")}
        </button>
      </div>

      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "8px", padding: "15px 25px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "2rem" }}>⌨️</div>
        <div>
          <h4 style={{ margin: "0 0 5px 0", color: "#fbbf24", fontSize: "1rem" }}>{isEn ? "Quick Operation Guide" : "Guía Rápida de Operación"}</h4>
          <div style={{ display: "flex", gap: "30px", color: "#e2e8f0" }}>
            <span><kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Ctrl</kbd> + <kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Enter</kbd> ➔ {isEn ? "Execute Current Decision" : "Ejecutar Decisión Actual"}</span>
            <span><kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Esc</kbd> ➔ {isEn ? "Cancel and Exit" : "Cancelar y Salir"}</span>
          </div>
        </div>
      </div>

      <textarea
        value={reporteTexto} onChange={(e) => setReporteTexto(e.target.value)} 
        placeholder={isEn ? "Loading transcription report..." : "Cargando reporte de transcripción..."}
        style={{ flex: 1, padding: "30px", backgroundColor: "#ffffff", color: "#0f172a", border: `2px solid ${obtenerColorBorde()}`, borderRadius: "8px", fontSize: "16px", lineHeight: "1.8", resize: "none", marginBottom: "20px", overflowY: "auto" }}
      />

      <div style={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
        <p style={{ color: "#f3f4f6", margin: "0 0 15px 0", fontWeight: "bold", fontSize: "1.1rem" }}>
          {isEn ? "Do you agree with the clinical findings transcribed by the assistant?" : "¿Está de acuerdo con los hallazgos clínicos transcritos por el asistente?"}
        </p>
        <div style={{ display: "flex", gap: "30px" }}>
          <label style={{ color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input type="radio" checked={aprobado === true} onChange={() => handleSeleccionAprobacion(true)} style={{ width: "18px", height: "18px", accentColor: "#10b981" }} /> 
            {isEn ? "Yes, validate report and proceed to sign." : "Sí, validar reporte y proceder a firma."}
          </label>
          <label style={{ color: "#ef4444", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input type="radio" checked={aprobado === false} onChange={() => handleSeleccionAprobacion(false)} style={{ width: "18px", height: "18px", accentColor: "#ef4444" }} /> 
            {isEn ? "No, reject and return with observations." : "No, rechazar y devolver con observaciones."}
          </label>
        </div>

        {aprobado === false && (
          <div style={{ marginTop: "15px" }}>
            <label style={{ display: "block", color: "#f3f4f6", marginBottom: "5px", fontSize: "14px" }}>
              {isEn ? "Clarifying note for the secretary / transcriber:" : "Nota aclaratoria para la secretaria / transcriptor:"}
            </label>
            <textarea
              value={notaRechazo} onChange={(e) => setNotaRechazo(e.target.value)}
              placeholder={isEn ? "Detail what corrections or additions are needed..." : "Indique detalladamente qué correcciones o agregados se necesitan..."}
              style={{ width: "100%", height: "80px", padding: "10px", backgroundColor: "#1f2937", color: "white", border: "1px solid #ef4444", borderRadius: "6px", resize: "none" }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "25px", opacity: aprobado === true ? 1 : 0.4, transition: "opacity 0.3s" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>{isEn ? "Radiologist Name:" : "Nombre del Radiólogo:"}</label>
          <input type="text" value={nombreMedico} onChange={(e) => setNombreMedico(e.target.value)} placeholder="Dr. ..." style={inputEstilo} disabled={aprobado !== true} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>{isEn ? "Medical Registration (MR):" : "Registro Médico (RM):"}</label>
          <input type="text" value={registroMedico} onChange={(e) => setRegistroMedico(e.target.value)} placeholder="Ej. RM-99857" style={inputEstilo} disabled={aprobado !== true} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px" }}>
        <button onClick={() => window.close()} disabled={estaGenerandoPdf} style={{ padding: "12px 25px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
          {isEn ? "Discard Changes" : "Descartar Cambios"}
        </button>
        
        <button 
          onClick={handleProcesarFirma} 
          disabled={estaGenerandoPdf || aprobado === null || (aprobado === false && !notaRechazo.trim())}
          style={{ padding: "12px 35px", backgroundColor: aprobado === null ? "#4b5563" : (aprobado ? "#10b981" : "#ef4444"), color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "1.1rem", cursor: (estaGenerandoPdf || aprobado === null) ? "not-allowed" : "pointer", boxShadow: aprobado === null ? "none" : `0 4px 15px ${aprobado ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}` }}
        >
          {estaGenerandoPdf 
            ? (isEn ? "⏳ Processing Operation..." : "⏳ Procesando Operación...") 
            : (aprobado === false 
                ? (isEn ? "❌ Return Report" : "❌ Devolver Informe") 
                : (isEn ? "🔏 Confirm and Sign Document" : "🔏 Confirmar y Firmar Documento")
              )
          }
        </button>
      </div>
    </div>
  );
}