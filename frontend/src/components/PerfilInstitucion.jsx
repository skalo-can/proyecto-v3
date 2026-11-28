import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useTranslation } from "react-i18next";
import BotonRegistroCentralNOC from "./BotonRegistroCentralNOC";

export default function PerfilInstitucion() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [perfil, setPerfil] = useState({
    nombre_clinica: "", nit_registro: "", direccion: "",
    telefono: "", email: "", sitio_web: "",
    modalidades_activas: ["CR", "DX", "US"],
    smtp_server: "", smtp_port: "", smtp_user: "", smtp_pass: "",
    wa_token: "", sms_api_key: "",
    envio_automatico: false
  });

  const MODALIDADES_DISPONIBLES = [
    { id: "CT", nombre: t('perfil_institucion.mod_ct') },
    { id: "MR", nombre: t('perfil_institucion.mod_mr') },
    { id: "DX", nombre: t('perfil_institucion.mod_dx') },
    { id: "CR", nombre: t('perfil_institucion.mod_cr') },
    { id: "US", nombre: t('perfil_institucion.mod_us') },
    { id: "MG", nombre: t('perfil_institucion.mod_mg') },
    { id: "DXA", nombre: t('perfil_institucion.mod_dxa') },
    { id: "PET", nombre: t('perfil_institucion.mod_pet') },
    { id: "RF", nombre: t('perfil_institucion.mod_rf') },
    { id: "XA", nombre: t('perfil_institucion.mod_xa') }
  ];

  // 🚀 CARGAR DATOS REALES AL MONTAR EL COMPONENTE
  useEffect(() => {
    fetch(`${window.API_URL}/api/admin/perfil-institucion`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setPerfil(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error("Error cargando perfil institucional:", err));
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPerfil(prev => ({ ...prev, [name]: value }));
  };

  const handleModalidadToggle = (idModalidad) => {
    setPerfil(prev => {
      const activas = prev.modalidades_activas;
      if (activas.includes(idModalidad)) {
        return { ...prev, modalidades_activas: activas.filter(m => m !== idModalidad) };
      } else {
        return { ...prev, modalidades_activas: [...activas, idModalidad] };
      }
    });
  };

  const handleToggleEnvio = () => {
    setPerfil(prev => ({ ...prev, envio_automatico: !prev.envio_automatico }));
  };

  // 🚀 GUARDAR DATOS REALES EN EL BACKEND
  const guardarPerfil = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${window.API_URL}/api/admin/perfil-institucion`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(perfil)
      });
      
      if (res.ok) {
        alert(t('perfil_institucion.msg_exito'));
      } else {
        alert(t('perfil_institucion.msg_error_servidor'));
      }
    } catch (err) {
      alert(t('perfil_institucion.msg_error_red'));
    } finally {
      setLoading(false);
    }
  };

  // 🛡️ ESTILOS AUTO-AJUSTABLES (100% RESPONSIVOS SIN DESBORDAMIENTO)
  const pageStyle = {
    padding: '18px 22px 44px 22px',
    color: '#fff',
    boxSizing: 'border-box',
    backgroundColor: '#0f1114',
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
  };

  const cardStyle = {
    background: '#1a1d21',
    padding: '20px 22px',
    borderRadius: '10px',
    border: '1px solid #333',
    marginBottom: '18px',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
  };

  const inputStyle = {
    background: '#0a0c0f',
    color: '#fbbf24',
    border: '1px solid #333',
    padding: '9px 12px',
    borderRadius: '6px',
    width: '100%',
    boxSizing: 'border-box',
    marginTop: '5px',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  };

  const fieldWrapperStyle = {
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: '16px 20px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const modGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: '10px',
    marginTop: '14px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const btnStyle = {
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    padding: '13px 25px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '0.98rem',
    width: '100%',
    boxSizing: 'border-box',
    transition: '0.2s',
    marginTop: '4px',
  };

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid #222',
          paddingBottom: '14px',
          marginBottom: '18px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ color: '#fbbf24', margin: 0, fontSize: '1.55rem', minWidth: 0 }}>
          {t('perfil_institucion.titulo')}
        </h2>
        <div style={{ minWidth: '215px', maxWidth: '100%', flexShrink: 0 }}>
          <BotonRegistroCentralNOC />
        </div>
      </div>
      
      <div style={cardStyle}>
        <h3 style={{ color: '#38bdf8', marginTop: 0, marginBottom: '14px', fontSize: '1.05rem' }}>
          {t('perfil_institucion.datos_generales')}
        </h3>
        <div style={gridStyle}>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_nombre_clinica')}</label>
            <input type="text" name="nombre_clinica" value={perfil.nombre_clinica} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_nombre_clinica')} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_nit')}</label>
            <input type="text" name="nit_registro" value={perfil.nit_registro} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_direccion')}</label>
            <input type="text" name="direccion" value={perfil.direccion} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_telefono')}</label>
            <input type="text" name="telefono" value={perfil.telefono} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_email')}</label>
            <input type="email" name="email" value={perfil.email} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_sitio_web')}</label>
            <input type="text" name="sitio_web" value={perfil.sitio_web} onChange={handleChange} style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: '#a855f7', marginTop: 0, marginBottom: '14px', fontSize: '1.05rem' }}>
          {t('perfil_institucion.pasarelas_envio')}
        </h3>
        
        <div
          style={{
            background: '#0a0c0f',
            padding: '14px 16px',
            borderRadius: '8px',
            border: perfil.envio_automatico ? '1px solid #10b981' : '1px solid #333',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.3s',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          <input type="checkbox" checked={perfil.envio_automatico} onChange={handleToggleEnvio} style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: '#10b981', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: perfil.envio_automatico ? '#10b981' : '#cbd5e1', fontSize: '0.95rem', display: 'block' }}>{t('perfil_institucion.envio_automatico')}</strong>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('perfil_institucion.desc_envio_automatico')}</span>
          </div>
        </div>

        <h4 style={{ color: '#38bdf8', fontSize: '0.92rem', borderBottom: '1px dashed #333', paddingBottom: '6px', marginTop: 0 }}>
          {t('perfil_institucion.servidor_smtp')}
        </h4>
        <div style={gridStyle}>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_smtp_server')}</label>
            <input type="text" name="smtp_server" value={perfil.smtp_server} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_smtp_server')} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_smtp_port')}</label>
            <input type="text" name="smtp_port" value={perfil.smtp_port} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_smtp_port')} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_correo_remitente')}</label>
            <input type="email" name="smtp_user" value={perfil.smtp_user} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_correo_remitente')} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_smtp_pass')}</label>
            <input type="password" name="smtp_pass" value={perfil.smtp_pass} onChange={handleChange} style={inputStyle} placeholder="********" />
          </div>
        </div>

        <h4 style={{ color: '#25D366', fontSize: '0.92rem', borderBottom: '1px dashed #333', paddingBottom: '6px', marginTop: '22px' }}>
          {t('perfil_institucion.apis_mensajeria')}
        </h4>
        <div style={gridStyle}>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_wa_token')}</label>
            <input type="password" name="wa_token" value={perfil.wa_token} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_wa_token')} />
          </div>
          <div style={fieldWrapperStyle}>
            <label style={{ fontSize: '0.83rem', color: '#94a3b8', fontWeight: 'bold' }}>{t('perfil_institucion.lbl_sms_key')}</label>
            <input type="password" name="sms_api_key" value={perfil.sms_api_key} onChange={handleChange} style={inputStyle} placeholder={t('perfil_institucion.ph_sms_key')} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: '#10b981', marginTop: 0, fontSize: '1.05rem' }}>{t('perfil_institucion.modalidades_activas')}</h3>
        <p style={{ fontSize: '0.83rem', color: '#94a3b8', margin: '4px 0 12px 0' }}>{t('perfil_institucion.desc_modalidades')}</p>
        <div style={modGrid}>
          {MODALIDADES_DISPONIBLES.map(mod => {
            const isChecked = perfil.modalidades_activas.includes(mod.id);
            return (
              <label
                key={mod.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: isChecked ? '#064e3b' : '#0a0c0f',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: isChecked ? '1px solid #10b981' : '1px solid #333',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              >
                <input type="checkbox" checked={isChecked} onChange={() => handleModalidadToggle(mod.id)} style={{ transform: 'scale(1.15)', accentColor: '#10b981', flexShrink: 0 }} />
                <span style={{ color: isChecked ? '#34d399' : '#cbd5e1', fontWeight: isChecked ? 'bold' : 'normal', fontSize: '0.86rem', lineHeight: 1.25 }}>
                  {mod.nombre}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <button onClick={guardarPerfil} style={btnStyle} disabled={loading}>
        {loading ? t('perfil_institucion.btn_guardando') : t('perfil_institucion.btn_guardar')}
      </button>
    </div>
  );
}