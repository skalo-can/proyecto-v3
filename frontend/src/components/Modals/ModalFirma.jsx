import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ModalFirma() {
  const { estudioId } = useParams();
  const [reporteTexto, setReporteTexto] = useState("");
  const [nombreMedico, setNombreMedico] = useState("");
  const [registroMedico, setRegistroMedico] = useState("");
  const [estaGenerandoPdf, setEstaGenerandoPdf] = useState(false);
  
  const [aprobado, setAprobado] = useState(null); 
  const [notaRechazo, setNotaRechazo] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  const [datosMedicoLogueado, setDatosMedicoLogueado] = useState({ nombre: "", rm: "" });

  // 🔥 RUTA DINÁMICA: Detecta si estamos en desarrollo o en la red del hospital
  const apiBase = window.location.origin.includes(":5173") 
    ? "http://localhost:8000" 
    : window.location.origin;

  // 🔄 CARGA INICIAL
  useEffect(() => {
    let nombreFinal = "";
    let rmFinal = "";

    const usuarioGuardado = localStorage.getItem("usuario") || localStorage.getItem("user");
    
    if (usuarioGuardado) {
      try {
        const usuarioObj = JSON.parse(usuarioGuardado);
        const nombre = usuarioObj.primer_nombre || "";
        const apellido = usuarioObj.primer_apellido || "";
        
        nombreFinal = `${nombre} ${apellido}`.trim() || usuarioObj.nombre || usuarioObj.nombre_completo || "";
        rmFinal = usuarioObj.registro_medico || usuarioObj.rm || usuarioObj.registro || usuarioObj.matricula || "";
        
      } catch (error) {
        console.warn("No se pudo analizar el objeto del usuario:", error);
      }
    }

    setDatosMedicoLogueado({ nombre: nombreFinal, rm: rmFinal });

    if (estudioId) {
      // 🔥 CORRECCIÓN: Recuperar texto usando ruta dinámica
      fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/obtener-transcripcion`)
        .then(res => res.json())
        .then(data => {
          const textoFinal = data.informe || data.informe_texto || data.informe_text || data.texto || data.informe_final || "";
          setReporteTexto(textoFinal);
        })
        .catch(err => console.error("❌ Error en fetch de transcripción:", err));
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
        if (aprobado !== null) {
          handleProcesarFirma();
        }
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
      alert("⚠️ Debe ingresar una nota de explicación breve para devolver el informe.");
      return;
    }

    setEstaGenerandoPdf(true);

    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

      // 🔥 CORRECCIÓN: Firma digital vinculada a la ruta dinámica
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/firmar-informe`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": tokenSesion ? `Bearer ${tokenSesion}` : "" 
        },
        body: JSON.stringify({
          informe_final: aprobado ? reporteTexto : (reporteTexto + `\n\n[NOTA DE CORRECCIÓN MÉDICA: ${notaRechazo}]`),
          medico_firma: nombreMedico,
          registro_medico: registroMedico,
          aprobado: aprobado,
          nota_rechazo: notaRechazo
        })
      });

      if (!response.ok) throw new Error("Error en la transacción clínica del backend.");

      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();

      window.close();
      
    } catch (error) {
      console.error("Error al procesar la operación:", error);
      alert("❌ Hubo un fallo al conectar con la API.");
    } finally {
      setEstaGenerandoPdf(false);
    }
  };

  const handleConsultarIA = async () => {
    setCargandoIA(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      
      // 🔥 CORRECCIÓN: Consulta a Gemini apuntando a la ruta dinámica
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/asistencia-ia`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": tokenSesion ? `Bearer ${tokenSesion}` : ""
        },
        body: JSON.stringify({ texto_actual: reporteTexto }) 
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Fallo de conexión con la IA");
      }

      const data = await response.json();
      
      const sugerenciaIA = `\n\n${data.sugerencia}`;
      setReporteTexto(prev => prev + sugerenciaIA);
      
    } catch (error) {
      console.error("Error en la consulta de IA:", error);
      alert(`❌ Error al invocar la IA: ${error.message}`);
    } finally {
      setCargandoIA(false);
    }
  };

  const obtenerColorBorde = () => {
    if (aprobado === true) return '#10b981'; 
    if (aprobado === false) return '#ef4444'; 
    return '#334155'; 
  };

  const layoutMultimonitor = { 
    width: '100vw', height: '100vh', background: '#07080a', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', padding: '30px',
    border: `8px solid ${obtenerColorBorde()}`, transition: 'all 0.3s ease', overflowY: 'auto'
  };

  const inputEstilo = { 
    flex: 1, padding: "15px", borderRadius: "6px", border: "1px solid #334155", 
    backgroundColor: "#0f172a", color: "#fff", fontSize: "1rem", transition: "all 0.3s"
  };

  return (
    <div style={layoutMultimonitor}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", margin: 0, fontSize: "1.8rem", display: "flex", alignItems: "center", gap: "10px" }}>
          🔏 Estación de Validación y Firma Digital
        </h2>
        <button
          onClick={handleConsultarIA} disabled={cargandoIA || estaGenerandoPdf}
          style={{
            padding: "10px 20px", backgroundColor: "#7c3aed", color: "white", border: "none",
            borderRadius: "6px", fontWeight: "bold", cursor: cargandoIA ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)", display: "flex", alignItems: "center", gap: "8px"
          }}
        >
          {cargandoIA ? "⏳ Procesando Red..." : "🤖 Solicitar Asistencia IA"}
        </button>
      </div>

      <div style={{ backgroundColor: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "8px", padding: "15px 25px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "2rem" }}>⌨️</div>
        <div>
          <h4 style={{ margin: "0 0 5px 0", color: "#fbbf24", fontSize: "1rem" }}>Guía Rápida de Operación</h4>
          <div style={{ display: "flex", gap: "30px", color: "#e2e8f0" }}>
            <span><kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Ctrl</kbd> + <kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Enter</kbd> ➔ Ejecutar Decisión Actual</span>
            <span><kbd style={{...inputEstilo, padding: "4px 8px", backgroundColor: "#1e293b", color: "#fbbf24"}}>Esc</kbd> ➔ Cancelar y Salir</span>
          </div>
        </div>
      </div>

      <textarea
        value={reporteTexto} onChange={(e) => setReporteTexto(e.target.value)} placeholder="Cargando reporte de transcripción..."
        style={{
          flex: 1, padding: "30px", backgroundColor: "#ffffff", color: "#0f172a",
          border: `2px solid ${obtenerColorBorde()}`, borderRadius: "8px", fontSize: "16px",
          lineHeight: "1.8", resize: "none", marginBottom: "20px", overflowY: "auto"
        }}
      />

      <div style={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
        <p style={{ color: "#f3f4f6", margin: "0 0 15px 0", fontWeight: "bold", fontSize: "1.1rem" }}>
          ¿Está de acuerdo con los hallazgos clínicos transcritos por el asistente?
        </p>
        <div style={{ display: "flex", gap: "30px" }}>
          <label style={{ color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input 
              type="radio" name="calidad_estudio" checked={aprobado === true}
              onChange={() => handleSeleccionAprobacion(true)}
              style={{ width: "18px", height: "18px", accentColor: "#10b981" }}
            /> Sí, validar reporte y proceder a firma.
          </label>
          <label style={{ color: "#ef4444", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input 
              type="radio" name="calidad_estudio" checked={aprobado === false}
              onChange={() => handleSeleccionAprobacion(false)}
              style={{ width: "18px", height: "18px", accentColor: "#ef4444" }}
            /> No, rechazar y devolver con observaciones.
          </label>
        </div>

        {aprobado === false && (
          <div style={{ marginTop: "15px" }}>
            <label style={{ display: "block", color: "#f3f4f6", marginBottom: "5px", fontSize: "14px" }}>Nota aclaratoria para la secretaria / transcriptor:</label>
            <textarea
              value={notaRechazo} onChange={(e) => setNotaRechazo(e.target.value)}
              placeholder="Indique detalladamente qué correcciones o agregados se necesitan en el dictado..."
              style={{ width: "100%", height: "80px", padding: "10px", backgroundColor: "#1f2937", color: "white", border: "1px solid #ef4444", borderRadius: "6px", resize: "none" }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "25px", opacity: aprobado === true ? 1 : 0.4, transition: "opacity 0.3s" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>Nombre del Radiólogo:</label>
          <input type="text" value={nombreMedico} onChange={(e) => setNombreMedico(e.target.value)} placeholder="Dr. / Dra. ..." style={inputEstilo} disabled={aprobado !== true} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "13px", marginBottom: "8px", color: "#94a3b8", fontWeight: "bold" }}>Registro Médico (RM):</label>
          <input type="text" value={registroMedico} onChange={(e) => setRegistroMedico(e.target.value)} placeholder="Ej. RM-99857" style={inputEstilo} disabled={aprobado !== true} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px" }}>
        <button onClick={() => window.close()} style={{ padding: "12px 25px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }} disabled={estaGenerandoPdf}>
          Descartar Cambios
        </button>
        
        <button 
          onClick={handleProcesarFirma} 
          disabled={estaGenerandoPdf || aprobado === null || (aprobado === false && !notaRechazo.trim())}
          style={{ 
            padding: "12px 35px", 
            backgroundColor: aprobado === null ? "#4b5563" : (aprobado ? "#10b981" : "#ef4444"), 
            color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "1.1rem",
            cursor: (estaGenerandoPdf || aprobado === null) ? "not-allowed" : "pointer",
            boxShadow: aprobado === null ? "none" : `0 4px 15px ${aprobado ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          }}
        >
          {estaGenerandoPdf ? "⏳ Procesando Operación..." : (aprobado === false ? "❌ Devolver Informe" : "🔏 Confirmar y Firmar Documento")}
        </button>
      </div>

    </div>
  );
}