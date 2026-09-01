import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./RecepcionForm.css"; 

export const RecepcionForm = ({ onRegisterOrder, initialData, onCancel, dynamicFields = [], orders = [] }) => {
  const { t } = useTranslation();
  
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

  const handleExtraChange = (e) => {
    const { name, value } = e.target;
    setExtraValues(prev => ({ ...prev, [name]: value }));
  };

  const handleAutoNN = () => {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().split('T')[0].replace(/-/g, ""); 
    const horas = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    const tiempoStr = `${horas}${minutos}${segundos}`;
    const idGenerado = `NN-${fechaStr}-${tiempoStr}`;
    const sufijoVisual = tiempoStr.slice(-4);

    setFormData({
      ...emptyForm,
      id_institucional: idGenerado,
      nombre: t('recepcion_form.paciente_nn'),
      apellido: `${t('recepcion_form.emergencia_nn')} ${sufijoVisual}`, 
      sexo: "O", 
      prioridad: "Urgente",
      area_solicitante: t('recepcion_form.urgencias'),
      medico_referente: t('recepcion_form.medico_turno')
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
      alert(t('recepcion_form.alerta_obligatorios'));
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
        
        {/* 1. ENCABEZADO FIJO */}
        <div className="form-header-fixed" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="form-title" style={{ margin: 0 }}>
            {initialData ? t('recepcion_form.modificar_orden') : t('recepcion_form.admision_paciente')}
          </h2>
          {!initialData && (
            <button type="button" onClick={handleAutoNN} className="btn-nn-emergency">
              {t('recepcion_form.ingreso_nn')}
            </button>
          )}
        </div>

        {/* 2. ÁREA CON SCROLL INTERNO */}
        <div className="form-scrollable-content">
          <div className="form-section">
            <h3><i className="fas fa-user"></i> {t('recepcion_form.identificacion_paciente')}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('recepcion_form.id_institucional')}</label>
                <input type="text" name="id_institucional" value={formData.id_institucional} onChange={handleChange} required placeholder={t('recepcion_form.placeholder_id')} />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.nombres')}</label>
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.apellidos')}</label>
                <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.fecha_nacimiento')}</label>
                <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.edad_dicom')}</label>
                <input 
                  type="text" 
                  value={extraValues.PatientAge || ""} 
                  onChange={(e) => setExtraValues({...extraValues, PatientAge: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.sexo')}</label>
                <select name="sexo" value={formData.sexo} onChange={handleChange} required>
                  <option value="">{t('recepcion_form.seleccione')}</option>
                  <option value="M">{t('recepcion_form.masculino')}</option>
                  <option value="F">{t('recepcion_form.femenino')}</option>
                  <option value="O">{t('recepcion_form.otro_nn')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3><i className="fas fa-file-medical"></i> {t('recepcion_form.detalles_estudio')}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('recepcion_form.modalidad')}</label>
                <select name="modalidad" value={formData.modalidad} onChange={handleChange} required>
                  <option value="">{t('recepcion_form.seleccione')}</option>
                  <option value="CR">{t('recepcion_form.mod_cr')}</option>
                  <option value="DR">{t('recepcion_form.mod_dr')}</option>
                  <option value="CT">{t('recepcion_form.mod_ct')}</option>
                  <option value="MR">{t('recepcion_form.mod_mr')}</option>
                  <option value="US">{t('recepcion_form.mod_us')}</option>
                  <option value="MG">{t('recepcion_form.mod_mg')}</option>
                  <option value="FL">{t('recepcion_form.mod_fl')}</option>
                  <option value="MN">{t('recepcion_form.mod_mn')}</option>
                  <option value="Angiografía">{t('recepcion_form.mod_angio')}</option>
                  <option value="DXA">{t('recepcion_form.mod_dxa')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.area_solicitante')}</label>
                <input type="text" name="area_solicitante" value={formData.area_solicitante} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>{t('recepcion_form.medico_referente')}</label>
                <input type="text" name="medico_referente" value={formData.medico_referente} onChange={handleChange} required />
              </div>

              {/* 🔥 RENDERIZADO DINÁMICO DE CAMPOS DICOM (MOTIVO Y NOTAS ANCHOS) */}
              {dynamicFields && [...dynamicFields]
                .sort((a, b) => {
                    // Ponemos 'Motivo' arriba de 'Notas'
                    if (a.nombre_mostrar.toLowerCase().includes("motivo")) return -1;
                    if (b.nombre_mostrar.toLowerCase().includes("motivo")) return 1;
                    return 0;
                })
                .map((campo) => {
                  const esCampoExtenso = 
                    campo.nombre_mostrar.toLowerCase().includes("nota") || 
                    campo.nombre_mostrar.toLowerCase().includes("motivo");

                  return (
                    <div 
                      className="form-group" 
                      key={campo.id} 
                      style={{ 
                        gridColumn: esCampoExtenso ? '1 / -1' : 'span 1', 
                        marginTop: '10px' 
                      }}
                    >
                      <label style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                        {campo.nombre_mostrar.toUpperCase()}
                      </label>
                      <textarea 
                        name={campo.tag_dicom}
                        value={extraValues[campo.tag_dicom] || ""}
                        onChange={handleExtraChange}
                        placeholder={`${t('recepcion_form.ingrese')} ${campo.nombre_mostrar}...`}
                        rows={campo.nombre_mostrar.toLowerCase().includes("nota") ? 5 : 3}
                        className="mapeo-textarea-recepcion"
                      />
                    </div>
                  );
              })}
            </div>
          </div>
        </div>

        {/* 3. BOTÓN CONFIRMAR SIEMPRE VISIBLE */}
        <div className="form-actions">
          <button type="submit" className="btn-confirmar">
            {initialData ? t('recepcion_form.guardar_cambios') : t('recepcion_form.confirmar_ingreso')}
          </button>
        </div>
      </form>
    </div>
  );
};