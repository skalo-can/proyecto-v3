import React, { useState, useEffect } from "react";
import "./RecepcionForm.css"; 

export const RecepcionForm = ({ onRegisterOrder, initialData, onCancel, dynamicFields = [], orders = [] }) => {
  const emptyForm = {
    id_institucional: "",
    nombre: "",
    apellido: "",
    fecha_nacimiento: "", 
    sexo: "",              
    modalidad: "",         
    medico_referente: "",
    area_solicitante: "",  
    prioridad: "Rutina",
    metadata_extra: {} 
  };

  const [formData, setFormData] = useState(emptyForm);
  const [extraValues, setExtraValues] = useState({ PatientAge: "" }); 

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      if (initialData.metadata_extra) {
        try {
          const parsed = typeof initialData.metadata_extra === 'string' 
            ? JSON.parse(initialData.metadata_extra) 
            : initialData.metadata_extra;
          setExtraValues(parsed || { PatientAge: "" });
        } catch (e) { setExtraValues({ PatientAge: "" }); }
      }
    } else {
      setFormData(emptyForm);
      setExtraValues({ PatientAge: "" });
    }
  }, [initialData]);

  // 🔥 SOLUCIÓN DEFINITIVA: ID Único basado en tiempo (Evita duplicados al borrar)
  const handleAutoNN = () => {
    const ahora = new Date();
    
    // 1. Formato Fecha: YYYYMMDD (ej: 20260411)
    const fechaStr = ahora.toISOString().split('T')[0].replace(/-/g, ""); 
    
    // 2. Formato Tiempo: HHMMSS (ej: 125030)
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    const tiempoStr = `${horas}${minutos}${segundos}`;
    
    // 3. ID Final: NN-20260411-125030
    const idGenerado = `NN-${fechaStr}-${tiempoStr}`;

    // 4. Sufijo visual para el nombre (usamos los últimos 4 dígitos del tiempo)
    const sufijoVisual = tiempoStr.slice(-4);

    setFormData({
      ...emptyForm,
      id_institucional: idGenerado,
      nombre: "PACIENTE",
      apellido: `EMERGENCIA ${sufijoVisual}`, 
      sexo: "O", 
      prioridad: "Urgente",
      area_solicitante: "URGENCIAS",
      medico_referente: "MEDICO TURNO"
    });
    
    setExtraValues({ PatientAge: "030Y" }); 
  };

  const calcularEdadDicom = (fechaNac) => {
    if (!fechaNac) return "";
    const hoy = new Date();
    const cumple = new Date(fechaNac);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return edad.toString().padStart(3, '0') + "Y";
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); 
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "fecha_nacimiento" && value) {
        setExtraValues(prevExtra => ({ ...prevExtra, PatientAge: calcularEdadDicom(value) }));
      }
      return newData;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const camposCriticos = ['id_institucional', 'nombre', 'apellido', 'sexo', 'modalidad', 'area_solicitante', 'medico_referente'];
    const incompletos = camposCriticos.filter(campo => !formData[campo]);
    
    if (incompletos.length > 0 || !extraValues.PatientAge) {
      alert("⚠️ ALERTA DE SEGURIDAD: Todos los campos con asterisco (*) son obligatorios.");
      return;
    }

    const finalData = {
      ...formData,
      metadata_extra: JSON.stringify({
        ...extraValues,
        PatientBirthDate: formData.fecha_nacimiento ? formData.fecha_nacimiento.replace(/-/g, "") : ""
      }) 
    };

    onRegisterOrder(finalData);
    setFormData(emptyForm); 
    setExtraValues({ PatientAge: "" });
    if (initialData) onCancel();
  };

  return (
    <div className="recepcion-container fade-in">
      <form className="glass-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} autoComplete="off">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="form-title" style={{ margin: 0 }}>
            {initialData ? "✏️ Modificar Orden (RIS)" : "Admisión de Paciente (RIS)"}
          </h2>
          {!initialData && (
            <button 
              type="button" 
              onClick={handleAutoNN}
              className="btn-nn-emergency"
              style={{ 
                background: '#ff4d4f', 
                color: 'white', 
                border: 'none', 
                padding: '10px 18px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                boxShadow: '0 4px 14px 0 rgba(255, 77, 79, 0.39)'
              }}
            >
              🚨 INGRESO NN (EMERGENCIA)
            </button>
          )}
        </div>

        <div className="form-section">
          <h3><i className="fas fa-user"></i> Identificación del Paciente</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>ID Institucional *</label>
              <input type="text" name="id_institucional" value={formData.id_institucional} onChange={handleChange} required placeholder="Cédula/NHC o ID-NN" />
            </div>
            <div className="form-group">
              <label>Nombres *</label>
              <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Apellidos *</label>
              <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Fecha de Nacimiento</label>
              <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Edad (DICOM) *</label>
              <input 
                type="text" 
                value={extraValues.PatientAge || ""} 
                onChange={(e) => setExtraValues({...extraValues, PatientAge: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Sexo *</label>
              <select name="sexo" value={formData.sexo} onChange={handleChange} required>
                <option value="">Seleccione...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro / NN</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3><i className="fas fa-file-medical"></i> Detalles del Estudio</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Modalidad *</label>
              <select name="modalidad" value={formData.modalidad} onChange={handleChange} required>
                <option value="">Seleccione...</option>
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
              <label>Área Solicitante *</label>
              <input type="text" name="area_solicitante" value={formData.area_solicitante} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Médico Referente *</label>
              <input type="text" name="medico_referente" value={formData.medico_referente} onChange={handleChange} required />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-confirmar">
            {initialData ? "💾 Guardar Cambios" : "Confirmar Ingreso y Notificar"}
          </button>
        </div>
      </form>
    </div>
  );
};