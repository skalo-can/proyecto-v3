import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

const MODALIDADES_DISPONIBLES = [
  { id: "CT", nombre: "CT - Tomografía" },
  { id: "MR", nombre: "MR - Resonancia" },
  { id: "DX", nombre: "DX - Flat Panel (Directo)" },
  { id: "CR", nombre: "CR - Casetes (Computarizado)" },
  { id: "US", nombre: "US - Ecografía" },
  { id: "MG", nombre: "MG - Mamografía" },
  { id: "DXA", nombre: "DXA - Densitometría" },
  { id: "PET", nombre: "PET - PET Scan" },
  { id: "RF", nombre: "RF - Arco en C (Fluoroscopía)" },
  { id: "XA", nombre: "XA - Arco en C (Vascular)" }
];

export default function PerfilInstitucion() {
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

  // 🚀 CARGAR DATOS REALES AL MONTAR EL COMPONENTE
  useEffect(() => {
    // ✅ AHORA
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
      // ✅ AHORA
      const res = await fetch(`${window.API_URL}/api/admin/perfil-institucion`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(perfil)
      });
      
      if (res.ok) {
        alert("✅ Perfil Institucional y Pasarelas de Comunicación guardados correctamente.");
      } else {
        alert("❌ Error al guardar el perfil en el servidor.");
      }
    } catch (err) {
      alert("❌ Error de red al intentar guardar.");
    } finally {
      setLoading(false);
    }
  };

  const pageStyle = { padding: '10px', color: '#fff', boxSizing: 'border-box', backgroundColor: '#0f1114', width: '100%' };
  const cardStyle = { background: '#1a1d21', padding: '25px', borderRadius: '10px', border: '1px solid #333', marginBottom: '20px' };
  const inputStyle = { background: '#0a0c0f', color: '#fbbf24', border: '1px solid #333', padding: '10px', borderRadius: '6px', width: '100%', marginTop: '5px', fontFamily: 'monospace' };
  const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
  const modGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginTop: '15px' };
  const btnStyle = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', width: '100%', transition: '0.2s' };

  return (
    <div style={pageStyle}>
      <h2 style={{ color: '#fbbf24', borderBottom: '1px solid #222', paddingBottom: '15px', marginTop: 0, fontSize: '1.8rem' }}>
        🏥 Configuración de Perfil Institucional
      </h2>
      
      <div style={cardStyle}>
        <h3 style={{ color: '#38bdf8', marginTop: 0, fontSize: '1.1rem' }}>📋 Datos Generales de la Clínica</h3>
        <div style={gridStyle}>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Nombre de la Clínica / Hospital</label><input type="text" name="nombre_clinica" value={perfil.nombre_clinica} onChange={handleChange} style={inputStyle} placeholder="Ej. Centro Radiológico Central" /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>NIT / Registro Legal</label><input type="text" name="nit_registro" value={perfil.nit_registro} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Dirección Física</label><input type="text" name="direccion" value={perfil.direccion} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Teléfono de Contacto</label><input type="text" name="telefono" value={perfil.telefono} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Correo Electrónico (Notificaciones)</label><input type="email" name="email" value={perfil.email} onChange={handleChange} style={inputStyle} /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Sitio Web / Portal Pacientes</label><input type="text" name="sitio_web" value={perfil.sitio_web} onChange={handleChange} style={inputStyle} /></div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: '#a855f7', marginTop: 0, fontSize: '1.1rem' }}>📡 Pasarelas de Envío (WhatsApp, Email, SMS)</h3>
        
        <div style={{ background: '#0a0c0f', padding: '15px', borderRadius: '8px', border: perfil.envio_automatico ? '1px solid #10b981' : '1px solid #333', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px', transition: 'all 0.3s' }}>
          <input type="checkbox" checked={perfil.envio_automatico} onChange={handleToggleEnvio} style={{ transform: 'scale(1.5)', cursor: 'pointer', accentColor: '#10b981' }} />
          <div>
            <strong style={{ color: perfil.envio_automatico ? '#10b981' : '#cbd5e1', fontSize: '1rem', display: 'block' }}>🤖 Envío Automático al Firmar (ON/OFF)</strong>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Si está activo, el sistema enviará los PDF automáticamente al paciente en el instante en que el Médico o Radiólogo firme el estudio.</span>
          </div>
        </div>

        <h4 style={{ color: '#38bdf8', fontSize: '0.95rem', borderBottom: '1px dashed #333', paddingBottom: '5px', marginTop: 0 }}>✉️ Servidor de Correo Institucional (SMTP)</h4>
        <div style={gridStyle}>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Servidor SMTP</label><input type="text" name="smtp_server" value={perfil.smtp_server} onChange={handleChange} style={inputStyle} placeholder="Ej. smtp.gmail.com u office365" /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Puerto SMTP</label><input type="text" name="smtp_port" value={perfil.smtp_port} onChange={handleChange} style={inputStyle} placeholder="Ej. 587 o 465" /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Correo Remitente</label><input type="email" name="smtp_user" value={perfil.smtp_user} onChange={handleChange} style={inputStyle} placeholder="resultados@miclinica.com" /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Contraseña de Aplicación SMTP</label><input type="password" name="smtp_pass" value={perfil.smtp_pass} onChange={handleChange} style={inputStyle} placeholder="********" /></div>
        </div>

        <h4 style={{ color: '#25D366', fontSize: '0.95rem', borderBottom: '1px dashed #333', paddingBottom: '5px', marginTop: '25px' }}>📱 APIs de Mensajería (WhatsApp & SMS)</h4>
        <div style={gridStyle}>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>Token WhatsApp API (Meta/Twilio)</label><input type="password" name="wa_token" value={perfil.wa_token} onChange={handleChange} style={inputStyle} placeholder="Ingrese el Token de Autorización" /></div>
          <div><label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'bold' }}>API Key SMS (Twilio/AWS/Otros)</label><input type="password" name="sms_api_key" value={perfil.sms_api_key} onChange={handleChange} style={inputStyle} placeholder="Ingrese la API Key" /></div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ color: '#10b981', marginTop: 0, fontSize: '1.1rem' }}>☢️ Modalidades Activas (Equipos en Servicio)</h3>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '5px 0 15px 0' }}>Seleccione únicamente los equipos con los que cuenta esta institución. Esto adaptará los filtros de búsqueda y las reglas de almacenamiento de Backups.</p>
        <div style={modGrid}>
          {MODALIDADES_DISPONIBLES.map(mod => {
            const isChecked = perfil.modalidades_activas.includes(mod.id);
            return (
              <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isChecked ? '#064e3b' : '#0a0c0f', padding: '12px', borderRadius: '6px', border: isChecked ? '1px solid #10b981' : '1px solid #333', cursor: 'pointer', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={isChecked} onChange={() => handleModalidadToggle(mod.id)} style={{ transform: 'scale(1.2)', accentColor: '#10b981' }} />
                <span style={{ color: isChecked ? '#34d399' : '#cbd5e1', fontWeight: isChecked ? 'bold' : 'normal', fontSize: '0.9rem' }}>{mod.nombre}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button onClick={guardarPerfil} style={btnStyle}>
        {loading ? "💾 GUARDANDO..." : "💾 GUARDAR PERFIL Y ACTUALIZAR SISTEMA"}
      </button>
    </div>
  );
} 