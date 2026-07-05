import React, { useState, useEffect, useRef } from "react";
import "./EditarModal.css";

export default function ModalTranscriptor({ visible, onClose, estudioId, onSave }) {
  const [texto, setTexto] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  // 🖱️ LÓGICA DE VENTANA FLOTANTE (DRAG & DROP)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const iniciarArrastre = (e) => {
    setIsDragging(true);
    // Calculamos la diferencia entre el clic del mouse y la posición actual del modal
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
      // Limpiamos los eventos de memoria al soltar el clic
      document.removeEventListener("mousemove", moverVentana);
      document.removeEventListener("mouseup", soltarVentana);
    };

    document.addEventListener("mousemove", moverVentana);
    document.addEventListener("mouseup", soltarVentana);
  };

  // Cargar datos al abrir
  useEffect(() => {
    if (visible && estudioId) {
      setAudioUrl(`http://localhost:8000/api/pacientes/${estudioId}/audio?t=${new Date().getTime()}`);
      setTexto("");
      // Resetea la posición al centro cuando se abre un paciente nuevo
      setPosicion({ x: 0, y: 0 }); 
    } else {
      setAudioUrl(null);
    }
  }, [visible, estudioId]);

  const handleGuardar = async () => {
    if (!texto.trim()) {
      alert("⚠️ Por favor, escriba la transcripción antes de guardar.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${estudioId}/guardar-transcripcion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ informe: texto }),
      });

      if (!response.ok) {
        throw new Error("Error en el servidor al procesar la transcripción.");
      }

      await response.json();

      onClose();            
      if (onSave) onSave(); 
      console.log("✅ Transcripción procesada y confirmada por el backend.");
      
    } catch (error) {
      console.error("Error al guardar transcripción:", error);
      alert("❌ Hubo un fallo al conectar con la API.");
    }
  };

  if (!visible) return null;

  return (
    // 🛡️ Al quitar el background oscuro o hacerlo transparente, el usuario no siente que bloquea la app
    <div className="modal-overlay" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      
      {/* CONTENEDOR PRINCIPAL DEL MODAL */}
      <div 
        className="modal glass-box" 
        style={{ 
          width: "750px", 
          minWidth: "500px", // 🛡️ Permite encogerla hasta 500px
          maxWidth: "95vw",  // 🛡️ Evita que se salga de la pantalla a lo ancho
          minHeight: "500px",
          maxHeight: "90vh", // 🛡️ Evita que se salga de la pantalla a lo alto
          padding: "30px", 
          display: "flex",
          flexDirection: "column",
          gap: "20px", 
          transform: `translate(${posicion.x}px, ${posicion.y}px)`, 
          transition: isDragging ? "none" : "transform 0.1s ease-out", 
          boxShadow: isDragging ? "0 25px 50px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.3)",
          resize: "both", 
          overflow: "hidden" // 🛡️ Mantiene la esquinita de agarre siempre visible
        }}
      >
        
        {/* CABECERA ARRASTRABLE */}
        <h3 
          onMouseDown={iniciarArrastre}
          style={{
            cursor: isDragging ? "grabbing" : "grab", // 🌟 Cambia la manito al agarrar
            margin: "-10px -10px 10px -10px",
            padding: "15px",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: "6px",
            border: "1px dashed rgba(255,255,255,0.2)",
            textAlign: "center",
            userSelect: "none", // Evita que se sombree el texto al arrastrar
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}
          title="Haz clic y arrastra para mover la ventana"
        >
          🖐️ Transcripción Humana 
        </h3>

        {/* REPRODUCTOR */}
        <div className="reproductor-controles" style={{ padding: "10px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
          <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%" }} />
          <div style={{ marginTop: "15px", display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.0)} style={{ padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }}>1x</button>
            <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.5)} style={{ padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }}>1.5x</button>
            <button onClick={() => audioRef.current && (audioRef.current.currentTime -= 5)} style={{ padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }}>⏪ -5s</button>
          </div>
        </div>

        {/* ÁREA DE TEXTO */}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escriba la transcripción aquí..."
          style={{
            flex: 1, 
            minHeight: "150px", // 🛡️ Más bajo para permitir que el modal se pueda encoger más
            padding: "24px 30px", 
            backgroundColor: "#ffffff",
            color: "#000000",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "15px",
            lineHeight: "1.8",
            resize: "none", // 🛡️ CLAVE: Quitamos su redimensión propia. Ahora obedece a la ventana.
            overflowY: "auto" // 🛡️ Si escriben muchísimo, le sale su propia barra de scroll
          }}
        />

        {/* CONTROLES INFERIORES */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          
          <button
            onClick={() => setTexto("ESTUDIO RADIOLÓGICO NORMAL:\n\nNo se observan alteraciones pleuropulmonares ni cardiovasculares agudas.\nEstructuras óseas sin lesiones aparentes.\nImpresión Diagnóstica: Estudio dentro de límites normales.")}
            style={{
              padding: "10px 15px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
            }}
          >
            📄 Cargar Plantilla Normal
          </button>

          <div className="modal-actions" style={{ margin: 0, padding: 0, gap: "15px", display: "flex" }}>
            <button className="btn cancelar" onClick={onClose} style={{ padding: "10px 20px" }}>Cerrar</button>
            <button className="btn guardar" onClick={handleGuardar} style={{ padding: "10px 20px" }}>Guardar Transcripción</button>
          </div>
        </div>

      </div>
    </div>
  );
}