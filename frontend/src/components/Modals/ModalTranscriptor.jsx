import React, { useState, useEffect, useRef } from "react";
import "./EditarModal.css"; // Reutilizamos estilos para mantener consistencia

export default function ModalTranscriptor({ visible, onClose, estudioId, onSave }) {
  const [texto, setTexto] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  // Cargar datos al abrir
  useEffect(() => {
    // #... [CODIGO ANTERIOR SIN CAMBIOS] ...
  }, [visible, estudioId]);

  const handleGuardar = async () => {
    // #... [CODIGO ANTERIOR SIN CAMBIOS] ...
  };

  // ¡CORRECCIÓN CLAVE!: Evita que el componente intente montar el audio y los refs 
  // si está oculto o no tiene un estudio asignado, lo que previene el Error 500 en Vite.
  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal glass-box" style={{ width: "600px" }}>
        <h3>Transcripción Humana</h3>

        {/* Reproductor con funciones reducidas */}
        <div className="reproductor-controles">
          <audio ref={audioRef} src={audioUrl} controls style={{ width: "100%" }} />
          <div style={{ marginTop: "10px" }}>
            {/* CORRECCIÓN: Validación de seguridad en el audioRef.current para evitar crasheos de memoria */}
            <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.0)}>1x</button>
            <button onClick={() => audioRef.current && (audioRef.current.playbackRate = 1.5)}>1.5x</button>
            <button onClick={() => audioRef.current && (audioRef.current.currentTime -= 5)}>⏪ -5s</button>
          </div>
        </div>

        <textarea 
          value={texto} 
          onChange={(e) => setTexto(e.target.value)}
          rows="10"
          style={{ width: "100%", marginTop: "20px" }}
        />

        <div className="modal-actions">
          <button className="btn cancelar" onClick={onClose}>Cerrar</button>
          <button className="btn guardar" onClick={handleGuardar}>Guardar Transcripción</button>
        </div>
      </div>
    </div>
  );
}