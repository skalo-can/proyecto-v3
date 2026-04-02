import React, { useState } from "react";
import "./EnviarModal.css";

export default function EnviarModal({ visible, onClose, data }) {

  const [destino, setDestino] = useState("");
  const [metodo, setMetodo] = useState("whatsapp");

  if (!visible) return null;

  const handleEnviar = () => {
    console.log("Enviando por:", metodo, "a:", destino, "data:", data);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal glass-box">

        <h3>Enviar estudio</h3>

        <label>Destino</label>
        <input
          type="text"
          placeholder="Número o correo"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
        />

        <label>Método</label>
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="link">Link Seguro</option>
        </select>

        <div className="modal-actions">
          <button className="btn cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn enviar" onClick={handleEnviar}>Enviar</button>
        </div>

      </div>
    </div>
  );
}