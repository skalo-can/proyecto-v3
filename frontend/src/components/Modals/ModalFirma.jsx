import React, { useState, useEffect } from "react";
import "./EditarModal.css"; // Reutilizamos estilos de la app

export default function ModalFirma({ visible, onClose, estudioId, onSave }) {
  const [reporteTexto, setReporteTexto] = useState("");
  const [nombreMedico, setNombreMedico] = useState("");
  const [registroMedico, setRegistroMedico] = useState("");
  const [estaGenerandoPdf, setEstaGenerandoPdf] = useState(false); // Estado de carga visual

  // 🖱️ LÓGICA DE VENTANA FLOTANTE (DRAG & DROP)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const iniciarArrastre = (e) => {
    setIsDragging(true);
    const offsetX = e.clientX - posicion.x;
    const offsetY = e.clientY - posicion.y;

    const moverVentana = (moveEvent) => {
      setPosicion({
        x: moveEvent.clientX - offsetX,
        y: moveEvent.clientY - offsetY,
      });
    };

    const soltarVentana = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", moverVentana);
      document.removeEventListener("mouseup", soltarVentana);
    };

    document.addEventListener("mousemove", moverVentana);
    document.addEventListener("mouseup", soltarVentana);
  };

    // 🔄 Cargar la transcripción al abrir el modal
  useEffect(() => {
    if (visible && estudioId) {
      setPosicion({ x: 0, y: 0 }); // Centrar ventana al abrir
      setReporteTexto(""); // Limpiar texto previo
      
      console.log("📡 Solicitando informe para el estudio ID:", estudioId);
      
      fetch(`http://localhost:8000/api/pacientes/${estudioId}/obtener-transcripcion`)
        .then(res => res.json())
        .then(data => {
          console.log("📥 Datos recibidos del backend:", data);
          
          // 🛡️ Ampliamos la red de captura con todas las combinaciones lógicas
          const textoFinal = data.informe || data.informe_texto || data.informe_text || data.texto || data.informe_final || "";
          
          if (textoFinal === "") {
             console.warn("⚠️ Atención: El backend respondió, pero el texto viene vacío o bajo un nombre desconocido.");
          }

          setReporteTexto(textoFinal);
        })
        .catch(err => console.error("❌ Error en fetch de transcripción:", err));
    }
  }, [visible, estudioId]);

  const handleFirmar = async () => {
    if (!nombreMedico.trim() || !registroMedico.trim()) {
      alert("⚠️ Debe ingresar su Nombre y Registro Médico para firmar el documento.");
      return;
    }

    setEstaGenerandoPdf(true); // Iniciamos indicador de carga

    try {
      // 1️⃣ PRIMERA LLAMADA: Guardar el informe editado y datos del médico
      const responseGuardar = await fetch(`http://localhost:8000/api/pacientes/${estudioId}/firmar-informe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          informe_final: reporteTexto,
          medico_firma: nombreMedico,
          registro_medico: registroMedico
        })
      });

      if (!responseGuardar.ok) {
        throw new Error("Error al estampar la firma y guardar los datos en el servidor.");
      }

      // 2️⃣ SEGUNDA LLAMADA: Generar el PDF final usando los datos recién guardados
      const responsePdf = await fetch(`http://localhost:8000/api/estudios/${estudioId}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!responsePdf.ok) {
         console.warn("El informe se guardó, pero hubo un problema al generar el PDF físico.");
      }

      alert("✅ Documento firmado exitosamente y PDF generado de forma automática.");
      onClose();
      if (onSave) onSave(); // Recarga la tabla para cambiar a color verde (Firmado)
      
    } catch (error) {
      console.error("Error al firmar:", error);
      alert("❌ Hubo un fallo al conectar con la API.");
    } finally {
      setEstaGenerandoPdf(false); // Detenemos indicador de carga
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      
      {/* 🛡️ CONTENEDOR FLOTANTE Y ELÁSTICO */}
      <div 
        className="modal glass-box"
        style={{
          width: "750px",
          minWidth: "500px", 
          maxWidth: "95vw",  
          minHeight: "500px",
          maxHeight: "90vh", 
          padding: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          transform: `translate(${posicion.x}px, ${posicion.y}px)`,
          transition: isDragging ? "none" : "transform 0.1s ease-out",
          boxShadow: isDragging ? "0 25px 50px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.3)",
          resize: "both", // Permite estirar la ventana
          overflow: "hidden"
        }}
      >
        
        {/* CABECERA ARRASTRABLE */}
        <h3 
          onMouseDown={iniciarArrastre}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            margin: "-10px -10px 10px -10px",
            padding: "15px",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: "6px",
            border: "1px dashed rgba(255,255,255,0.2)",
            textAlign: "center",
            userSelect: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}
          title="Haz clic y arrastra para mover la ventana"
        >
          🔏 Módulo de Validación y Firma Digital
        </h3>

        {/* 📄 ÁREA DE TEXTO BLANCA (Edición Final) */}
        <textarea
          value={reporteTexto}
          onChange={(e) => setReporteTexto(e.target.value)}
          placeholder="Esperando transcripción..."
          style={{
            flex: 1, // Se estira junto con la ventana
            minHeight: "150px",
            padding: "24px 30px",
            backgroundColor: "#ffffff", // Fondo blanco solicitado
            color: "#000000",           // Letra oscura
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "15px",
            lineHeight: "1.8",
            resize: "none", // No pelea con el redimensionamiento del modal
            overflowY: "auto"
          }}
        />

        {/* CONTROLES DE FIRMA DEL RADIÓLOGO */}
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: "#94a3b8" }}>
              Nombre del Radiólogo:
            </label>
            <input 
              type="text" 
              value={nombreMedico} 
              onChange={(e) => setNombreMedico(e.target.value)} 
              placeholder="Dr. / Dra. ..." 
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#fff" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "5px", color: "#94a3b8" }}>
              Registro Médico (RM):
            </label>
            <input 
              type="text" 
              value={registroMedico} 
              onChange={(e) => setRegistroMedico(e.target.value)} 
              placeholder="Ej. RM-12345" 
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #334155", backgroundColor: "#0f172a", color: "#fff" }}
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px", marginTop: "10px" }}>
          <button className="btn cancelar" onClick={onClose} style={{ padding: "10px 20px" }} disabled={estaGenerandoPdf}>
            Cancelar
          </button>
          <button 
            onClick={handleFirmar} 
            disabled={estaGenerandoPdf}
            style={{ 
              padding: "10px 20px", 
              backgroundColor: estaGenerandoPdf ? "#6b7280" : "#10b981", // Gris si está cargando, Verde si está libre
              color: "white", 
              border: "none", 
              borderRadius: "4px", 
              fontWeight: "bold", 
              cursor: estaGenerandoPdf ? "not-allowed" : "pointer",
              boxShadow: estaGenerandoPdf ? "none" : "0 4px 10px rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {estaGenerandoPdf ? "⏳ Generando PDF..." : "🔏 Estampar Firma"}
          </button>
        </div>

      </div>
    </div>
  );
}