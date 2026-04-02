import React, { useState, useEffect } from "react";
import "./EditarModal.css";

export default function EditarModal({ visible, onClose, data, onSave }) {

  const [form, setForm] = useState({});

  useEffect(() => {
    setForm(data || {});
  }, [data]);

  if (!visible) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGuardar = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal glass-box">

        <h3>Editar datos</h3>

        <label>Nombre</label>
        <input name="nombre" value={form.nombre || ""} onChange={handleChange} />

        <label>Apellido</label>
        <input name="apellido" value={form.apellido || ""} onChange={handleChange} />

        <label>Modalidad (si aplica)</label>
        <input name="modality" value={form.modality || ""} onChange={handleChange} />

        <div className="modal-actions">
          <button className="btn cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn guardar" onClick={handleGuardar}>Guardar</button>
        </div>

      </div>
    </div>
  );
}