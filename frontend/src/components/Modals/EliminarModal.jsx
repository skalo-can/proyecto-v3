import React from "react";
import "./EliminarModal.css";

export default function EliminarModal({ visible, onClose, onConfirm, data }) {

  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal glass-box">

        <h3>¿Eliminar registro?</h3>
        <p>Esta acción no se puede deshacer.</p>

        <div className="modal-actions">
          <button className="btn cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn eliminar" onClick={() => onConfirm(data)}>Eliminar</button>
        </div>

      </div>
    </div>
  );
}