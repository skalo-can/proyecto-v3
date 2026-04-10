import React, { useState, useEffect } from "react";
import "./RecepcionForm.css"; 

export const RecepcionForm = ({ onRegisterOrder, initialData, onCancel }) => {
  const emptyForm = {
    id_institucional: "",
    nombre: "",
    apellido: "",
    fecha_nacimiento: "",
    sexo: "M",
    modalidad: "DR", 
    medico_referente: "",
    prioridad: "Rutina",
    telefono: "",
    email: ""
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(emptyForm);
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegisterOrder(formData);
    setFormData(emptyForm); 
    if (initialData) onCancel();
  };

  return (
    <div className="recepcion-container fade-in">
      <form className="glass-form" onSubmit={handleSubmit}>
        <h2 className="form-title">
          {initialData ? "✏️ Modificar Orden (RIS)" : "Admisión de Paciente (RIS)"}
        </h2>

        <div className="form-section">
          <h3><i className="fas fa-user"></i> Identificación del Paciente</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>ID Institucional (Cédula/NHC)</label>
              <input type="text" name="id_institucional" value={formData.id_institucional} onChange={handleChange} required placeholder="Ej: 12345678" />
            </div>
            <div className="form-group">
              <label>Nombres</label>
              <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Apellidos</label>
              <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Sexo</label>
              <select name="sexo" value={formData.sexo} onChange={handleChange}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3><i className="fas fa-file-medical"></i> Detalles del Estudio</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Modalidad</label>
              <select name="modalidad" value={formData.modalidad} onChange={handleChange}>
                <option value="CR">Radiología Convencional (CR)</option>
                <option value="DR">Radiología Digital (DR)</option>
                <option value="CT">Tomografía (CT)</option>
                <option value="MR">Resonancia (MR)</option>
                <option value="US">Ecografía (US)</option>
                <option value="MG">Mamografía (MG)</option>
                <option value="FL">Fluoroscopia (FL)</option>
                <option value="MN">Medicina Nuclear (MN)</option>
                <option value="Angiografía">Angiografía</option>
                <option value="DXA">Densitometría (DXA)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Médico Referente</label>
              <input type="text" name="medico_referente" value={formData.medico_referente} onChange={handleChange} placeholder="Dr. Solicitante" />
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <div className="priority-selector">
                {["Rutina", "Prioritario", "Urgente"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn-priority ${p.toLowerCase()} ${formData.prioridad === p ? "active" : ""}`}
                    onClick={() => setFormData({ ...formData, prioridad: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className={initialData ? "btn-confirmar edit-mode" : "btn-confirmar"}>
            {initialData ? "💾 Guardar Cambios" : "Confirmar Ingreso y Notificar"}
          </button>
          
          {initialData && (
            <button 
              type="button" 
              className="btn-cancelar" 
              onClick={() => {
                setFormData(emptyForm); 
                onCancel(); 
              }}
              style={{
                marginTop: '10px', 
                background: 'transparent', 
                color: '#ff4d4d', 
                border: '1px solid #ff4d4d', 
                borderRadius: '8px', 
                padding: '10px', 
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Cancelar Edición
            </button>
          )}
        </div>
      </form>
    </div>
  );
};