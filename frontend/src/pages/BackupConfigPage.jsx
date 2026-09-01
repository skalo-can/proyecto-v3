/**
 * BackupConfigPage.jsx — MI_PACS
 * Panel de Control del Ciclo de Vida, Copias de Seguridad y Purga Legal de DICOM
 */

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { useTranslation } from "react-i18next";

export default function BackupConfigPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  const [diasMaduracion, setDiasMaduracion] = useState(30);
  const [nasRuta, setNasRuta] = useState("D:\\MI_PACS_NAS_EXTERNAL");
  const [copiaInternacional, setCopiaInternacional] = useState(true);
  
  const [modalidades, setModalidades] = useState({
    CT: true, MR: true, DX: true, US: true, CR: false, MG: false, DXA: false, PET: false, RF: false, XA: false
  });

  const [horaBackup, setHoraBackup] = useState("01:00");
  const [umbralPurga, setUmbralPurga] = useState(80);

  const [retencionLegalAnios, setRetencionLegalAnios] = useState(10);
  const [escudoPediatrico, setEscudoPediatrico] = useState(true);
  const [desbloquearPurga, setDesbloquearPurga] = useState(false);

  // 🚀 ESTADOS PARA LA BARRA DE PROGRESO ASÍNCRONA
  const [progresoRutina, setProgresoRutina] = useState({
    en_progreso: false,
    exitosos: 0,
    fallidos: 0,
    total_detectados: 0,
    finalizado: false,
    operacion: "" // "backup" o "vacuum"
  });
  const intervaloProgreso = useRef(null);

  useEffect(() => {
    // 1. Cargar configuración de base de datos (Cron y Legal)
    fetch("http://192.168.5.21:8000/api/admin/config", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setHoraBackup(data.hora_backup || "01:00");
          setUmbralPurga(data.umbral_purga || 80);
          if (data.retencion_legal_anios) setRetencionLegalAnios(data.retencion_legal_anios);
          if (data.escudo_pediatrico !== undefined) setEscudoPediatrico(data.escudo_pediatrico);
        }
      })
      .catch((err) => console.error("Error cargando parámetros DB:", err));

    // 🚀 2. NUEVO: Cargar configuración del JSON (Modalidades, Ruta NAS, Maduración)
    fetch("http://192.168.5.21:8000/api/backup/config", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.dias_maduracion) setDiasMaduracion(data.dias_maduracion);
          if (data.nas_ruta) setNasRuta(data.nas_ruta);
          if (data.copia_internacional !== undefined) setCopiaInternacional(data.copia_internacional);
          
          // Reconstruir el estado de los checkboxes basado en el array guardado
          if (data.modalidades) {
            const modsGuardadas = {
              CT: false, MR: false, DX: false, US: false, CR: false, MG: false, DXA: false, PET: false, RF: false, XA: false
            };
            data.modalidades.forEach(mod => {
              if (modsGuardadas[mod] !== undefined) {
                modsGuardadas[mod] = true;
              }
            });
            setModalidades(modsGuardadas);
          }
        }
      })
      .catch((err) => console.error("Error cargando parámetros JSON:", err));
  }, [token]);

  // 🚀 LÓGICA DE RECONEXIÓN Y POLLING (Igual a ImportarPage) - NO SE TOCA
  const verificarEstadoRutina = async () => {
    try {
        const res = await fetch("http://192.168.5.21:8000/api/admin/estado-rutina", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.finalizado === true) {
            if (!intervaloProgreso.current) return;
            clearInterval(intervaloProgreso.current);
            intervaloProgreso.current = null;
            setLoading(false);
            setProgresoRutina(data);
            setMensaje({ texto: t('backup_config.msg_operacion_exito'), tipo: "success" });
            
            // Limpiar la barra después de 5 segundos
            setTimeout(() => {
                setProgresoRutina(prev => ({ ...prev, en_progreso: false }));
            }, 5000);
        } else {
            if (intervaloProgreso.current) {
                setProgresoRutina(data);
            }
        }
    } catch (err) {
        console.error("Error al rastrear la rutina:", err);
    }
  };

  useEffect(() => {
    let componenteMontado = true;
    const reconectarProgreso = async () => {
        try {
            const res = await fetch("http://192.168.5.21:8000/api/admin/estado-rutina", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (componenteMontado && data && data.en_progreso && !data.finalizado) {
                if (intervaloProgreso.current) clearInterval(intervaloProgreso.current);
                setProgresoRutina(data);
                setLoading(true);
                intervaloProgreso.current = setInterval(verificarEstadoRutina, 1500);
            }
        } catch (err) {
            console.error("No se pudo reconectar al estado del motor:", err);
        }
    };
    
    reconectarProgreso();
    return () => { 
        componenteMontado = false; 
        if (intervaloProgreso.current) clearInterval(intervaloProgreso.current); 
    };
  }, [token]);

  const handleGuardarConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    const modSeleccionadas = Object.keys(modalidades).filter(key => modalidades[key]);

    try {
      const resBackup = await fetch("http://192.168.5.21:8000/api/backup/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dias_maduracion: diasMaduracion, modalidades: modSeleccionadas, nas_ruta: nasRuta, copia_internacional: copiaInternacional })
      });

      const resCron = await fetch("http://192.168.5.21:8000/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hora_backup: horaBackup, umbral_purga: umbralPurga, retencion_legal_anios: retencionLegalAnios, escudo_pediatrico: escudoPediatrico })
      });

      if (resBackup.ok && resCron.ok) {
        setMensaje({ texto: t('backup_config.msg_config_aplicada'), tipo: "success" });
      } else {
        setMensaje({ texto: t('backup_config.msg_fallo_sincronizar'), tipo: "error" });
      }
    } catch (err) {
      setMensaje({ texto: t('backup_config.msg_error_conexion'), tipo: "error" });
    } finally { setLoading(false); }
  };

  const handleForzarBackup = async () => {
    if (!window.confirm(t('backup_config.confirm_ejecutar_rutina'))) return;
    setLoading(true);
    try {
      const response = await fetch("http://192.168.5.21:8000/api/backup/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Si el backend es asíncrono y devuelve processing, iniciamos la barra
      if (response.ok && data.status === "processing") {
        if (intervaloProgreso.current) clearInterval(intervaloProgreso.current);
        setProgresoRutina({ en_progreso: true, exitosos: 0, fallidos: 0, total_detectados: data.archivos_detectados || 100, finalizado: false, operacion: "backup" });
        intervaloProgreso.current = setInterval(verificarEstadoRutina, 1500);
      } else if (response.ok) {
        setMensaje({ texto: "🚀 " + data.message, tipo: "success" });
        setLoading(false);
      } else {
        setMensaje({ texto: t('backup_config.msg_error_iniciar'), tipo: "error" });
        setLoading(false);
      }
    } catch (err) {
      setMensaje({ texto: t('backup_config.msg_error_red_proceso'), tipo: "error" });
      setLoading(false);
    }
  };

  const handleMantenimientoProfundo = async () => {
    if (!window.confirm(t('backup_config.confirm_mantenimiento'))) return;
    setLoading(true);
    try {
      const response = await fetch("http://192.168.5.21:8000/api/admin/mantenimiento-profundo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok && data.status === "processing") {
        if (intervaloProgreso.current) clearInterval(intervaloProgreso.current);
        setProgresoRutina({ en_progreso: true, exitosos: 0, fallidos: 0, total_detectados: 100, finalizado: false, operacion: "vacuum" });
        intervaloProgreso.current = setInterval(verificarEstadoRutina, 1500);
      } else if (response.ok) {
        setMensaje({ texto: "✨ " + data.message, tipo: "success" });
        setLoading(false);
      } else {
        setMensaje({ texto: t('backup_config.msg_error_motor_bd'), tipo: "error" });
        setLoading(false);
      }
    } catch (err) {
      setMensaje({ texto: t('backup_config.msg_error_red_mantenimiento'), tipo: "error" });
      setLoading(false);
    }
  };

  // 🚀 LÓGICA DE CANCELACIÓN
  const handleCancelarRutina = async () => {
    if (!window.confirm(t('backup_config.confirm_detener_proceso'))) return;
    try {
        await fetch("http://192.168.5.21:8000/api/admin/cancelar-rutina", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        setMensaje({ texto: t('backup_config.msg_orden_cancelacion'), tipo: "info" });
    } catch (err) {
        alert(t('backup_config.msg_error_cancelar'));
    }
  };

  const handleCheckboxChange = (mod) => {
    setModalidades({ ...modalidades, [mod]: !modalidades[mod] });
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>{t('backup_config.titulo')}</h2>
      <p style={{ color: "#aaa", marginBottom: "25px" }}>
        {t('backup_config.subtitulo')}
      </p>

      {mensaje.texto && (
        <div style={{ ...alertStyle, backgroundColor: mensaje.tipo === "success" ? "#10b98122" : mensaje.tipo === "info" ? "#3b82f622" : "#ef444422", borderColor: mensaje.tipo === "success" ? "#10b981" : mensaje.tipo === "info" ? "#3b82f6" : "#ef4444" }}>
          {mensaje.texto}
        </div>
      )}

      {/* 🚀 MONITOREO ASÍNCRONO PERSISTENTE */}
      {progresoRutina.en_progreso && (
          <div style={{ marginBottom: '25px', backgroundColor: 'rgba(251, 191, 36, 0.03)', border: '1px solid #fbbf24', padding: '20px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ color: '#fbbf24', margin: '0', fontSize: '1rem' }}>
                      📊 {progresoRutina.operacion === "vacuum" ? t('backup_config.monitor_mantenimiento') : t('backup_config.monitor_rutina')}
                  </h3>
                  <button onClick={handleCancelarRutina} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('backup_config.btn_cancelar_proceso')}</button>
              </div>
              <div style={{ display: 'flex', gap: '30px', color: '#fff', fontSize: '0.9rem' }}>
                  <div>{t('backup_config.tareas_detectadas')} <strong style={{ color: '#fbbf24' }}>{progresoRutina.total_detectados}</strong></div>
                  <div>{t('backup_config.completadas')} <strong style={{ color: '#10b981' }}>{progresoRutina.exitosos}</strong></div>
                  <div>{t('backup_config.errores')} <strong style={{ color: '#ef4444' }}>{progresoRutina.fallidos}</strong></div>
              </div>
              <div style={{ backgroundColor: '#222', height: '10px', borderRadius: '5px', marginTop: '15px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#10b981', height: '100%', width: `${progresoRutina.total_detectados > 0 ? (progresoRutina.exitosos / progresoRutina.total_detectados) * 100 : 0}%`, transition: 'width 0.3s ease' }}></div>
              </div>
          </div>
      )}

      <div style={gridLayout}>
        
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN GENERAL */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>{t('backup_config.titulo_reglas_nas')}</h3>
          <form onSubmit={handleGuardarConfig}>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t('backup_config.lbl_maduracion')}</label>
                <select style={inputStyle} value={diasMaduracion} onChange={(e) => setDiasMaduracion(Number(e.target.value))}>
                  <option value={15}>{t('backup_config.opt_15_dias')}</option>
                  <option value={20}>{t('backup_config.opt_20_dias')}</option>
                  <option value={30}>{t('backup_config.opt_30_dias')}</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t('backup_config.lbl_hora_rutina')}</label>
                <input type="time" style={inputStyle} value={horaBackup} onChange={(e) => setHoraBackup(e.target.value)} />
              </div>
            </div>

            <label style={labelStyle}>{t('backup_config.lbl_ruta_nas')}</label>
            <input type="text" style={inputStyle} value={nasRuta} onChange={(e) => setNasRuta(e.target.value)} placeholder={t('backup_config.placeholder_ruta_nas')} />

            <div style={legalBoxStyle}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f87171', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> {t('backup_config.titulo_purga_legal')}
              </h4>
              <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '15px', lineHeight: '1.4' }}>
                {t('backup_config.desc_purga_legal')}
              </p>

              <label style={labelStyle}>{t('backup_config.lbl_retencion_adultos')}</label>
              <select style={inputStyle} value={retencionLegalAnios} onChange={(e) => setRetencionLegalAnios(Number(e.target.value))}>
                <option value={5}>{t('backup_config.opt_5_anos')}</option>
                <option value={10}>{t('backup_config.opt_10_anos')}</option>
                <option value={15}>{t('backup_config.opt_15_anos')}</option>
                <option value={20}>{t('backup_config.opt_20_anos')}</option>
                <option value={999}>{t('backup_config.opt_nunca_eliminar')}</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: escudoPediatrico ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "6px", border: escudoPediatrico ? "1px solid #10b981" : "1px solid #444", transition: 'all 0.3s' }}>
                <input type="checkbox" checked={escudoPediatrico} onChange={(e) => setEscudoPediatrico(e.target.checked)} style={{ accentColor: "#10b981", transform: "scale(1.2)" }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: "bold", color: escudoPediatrico ? '#10b981' : '#fff' }}>{t('backup_config.lbl_escudo_pediatrico')}</span>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", margin: "20px 0", flexWrap: "wrap" }}>
              {Object.keys(modalidades).map((mod) => (
                <label key={mod} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#ddd", background: "#0a0c0f", padding: "6px 12px", borderRadius: "6px", border: "1px solid #222" }}>
                  <input type="checkbox" checked={modalidades[mod]} onChange={() => handleCheckboxChange(mod)} style={{ accentColor: "#fbbf24" }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{mod}</span>
                </label>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "25px" }}>
              <input type="checkbox" checked={copiaInternacional} onChange={() => setCopiaInternacional(!copiaInternacional)} style={{ accentColor: "#fbbf24" }} />
              <span style={{ fontWeight: "bold" }}>{t('backup_config.lbl_replica_nube')}</span>
            </label>

            <button type="submit" disabled={loading} style={btnGuardarStyle}>
              {loading ? t('backup_config.btn_aplicando') : t('backup_config.btn_guardar_config')}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: ACCIONES EN TIEMPO REAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={cardStyle}>
            <h3 style={sectionTitle}>{t('backup_config.titulo_rutina_diaria')}</h3>
            <div style={{ padding: "15px", background: "#000", borderRadius: "8px", border: "1px solid #222", marginBottom: "20px" }}>
              <span style={{ color: "#888", fontSize: "0.8rem", display: "block" }}>{t('backup_config.estado_robot_limpieza')}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#10b981", boxShadow: "0 0 8px #10b981" }}></div>
                <strong style={{ color: "#fff" }}>{t('backup_config.armado_hora_1')}{horaBackup}{t('backup_config.armado_hora_2')}</strong>
              </div>
            </div>
            <button onClick={handleForzarBackup} disabled={loading} style={btnForzarStyle}>
              {t('backup_config.btn_ejecutar_rutina')}
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{...sectionTitle, color: '#f87171'}}>{t('backup_config.titulo_mantenimiento')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.5rem' }}>🗜️</span>
              <div>
                <span style={{ display: 'block', color: '#f87171', fontWeight: 'bold', fontSize: '0.9rem' }}>{t('backup_config.lbl_vacuum')}</span>
                <span style={{ color: '#aaa', fontSize: '0.75rem' }}>{t('backup_config.desc_vacuum')}</span>
              </div>
            </div>
            <button onClick={handleMantenimientoProfundo} disabled={loading} style={{...btnForzarStyle, borderColor: '#f87171', color: '#f87171'}}>
              {t('backup_config.btn_iniciar_optimizacion')}
            </button>
          </div>

          {/* PURGA DE IMPORTADOS */}
          <div style={cardStyle}>
            <h3 style={{ color: '#f87171', marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
              {t('backup_config.titulo_limpieza_externos')}
            </h3>
            
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: desbloquearPurga ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "6px", border: desbloquearPurga ? "1px solid #ef4444" : "1px solid #444", transition: 'all 0.3s', marginBottom: '15px' }}>
              <input type="checkbox" checked={desbloquearPurga} onChange={(e) => setDesbloquearPurga(e.target.checked)} style={{ accentColor: "#ef4444", transform: "scale(1.2)" }} />
              <span style={{ fontWeight: "bold", color: desbloquearPurga ? '#ef4444' : '#fff', fontSize: '0.9rem' }}>
                {desbloquearPurga ? t('backup_config.purga_desbloqueada') : t('backup_config.autorizar_purga')}
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#0a0c0f', padding: '15px', borderRadius: '8px', border: '1px solid #222', opacity: desbloquearPurga ? 1 : 0.5, pointerEvents: desbloquearPurga ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  {t('backup_config.lbl_retencion_externos')}
                </label>
                <select id="dias_retencion" style={{ background: '#111418', color: '#fbbf24', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', width: '100%', fontFamily: 'monospace' }} defaultValue="30">
                  <option value="15">{t('backup_config.opt_15_dias').split('(')[0].trim()}</option>
                  <option value="30">{t('backup_config.opt_30_dias')}</option>
                  <option value="60">{t('backup_config.opt_60_dias')}</option>
                  <option value="90">{t('backup_config.opt_90_dias')}</option>
                </select>
              </div>

              <button 
                disabled={!desbloquearPurga}
                onClick={async () => {
                  if(window.confirm(t('backup_config.confirm_eliminar_dicom'))) {
                    const dias = document.getElementById("dias_retencion").value;
                    try {
                      const res = await fetch(`http://192.168.5.21:8000/api/purgar-importados?dias_retencion=${dias}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const data = await res.json();
                      if(res.ok) {
                        alert(`${t('backup_config.msg_exito')}${data.mensaje}`);
                        setDesbloquearPurga(false); 
                      } else {
                        alert(`${t('backup_config.msg_error')}${data.detail}`);
                      }
                    } catch(e) {
                      alert(t('backup_config.msg_fallo_conexion'));
                    }
                  }
                }}
                style={{ 
                  background: desbloquearPurga ? 'rgba(239, 68, 68, 0.1)' : '#1a1d21', 
                  color: desbloquearPurga ? '#f87171' : '#555', 
                  border: desbloquearPurga ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #333', 
                  padding: '10px 20px', 
                  borderRadius: '6px', 
                  fontWeight: 'bold', 
                  cursor: desbloquearPurga ? 'pointer' : 'not-allowed', 
                  transition: 'all 0.2s', width: '100%'
                }}
              >
                {t('backup_config.btn_ejecutar_purga_ahora')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ESTILOS DE INTERFAZ LIGEROS (SIN BLOQUEO DE SCROLL)
const containerStyle = { color: "white", width: "100%", boxSizing: "border-box" };
const titleStyle = { color: "#fbbf24", marginBottom: "5px", borderLeft: "4px solid #fbbf24", paddingLeft: "15px" };
const gridLayout = { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "25px", marginTop: "20px" };
const cardStyle = { background: "#1a1d21", padding: "25px", borderRadius: "12px", border: "1px solid #333", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" };
const sectionTitle = { color: "#fbbf24", fontSize: "1.1rem", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px", fontWeight: "bold" };
const labelStyle = { color: "#94a3b8", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px", display: "block" };
const inputStyle = { background: "#0f1114", border: "1px solid #333", color: "#fff", padding: "10px 15px", borderRadius: "6px", width: "100%", boxSizing: "border-box", marginBottom: "20px", fontSize: "0.95rem", transition: "border 0.3s" };
const legalBoxStyle = { background: "rgba(239, 68, 68, 0.03)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", padding: "20px", marginBottom: "25px" };
const alertStyle = { padding: "15px", borderRadius: "8px", border: "1px solid", marginBottom: "20px", color: "#fff", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "10px" };
const btnGuardarStyle = { background: "linear-gradient(135deg, #fbbf24, #d97706)", color: "#000", border: "none", padding: "14px 25px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", width: "100%", fontSize: "1rem", transition: "transform 0.1s" };
const btnForzarStyle = { background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", padding: "14px 25px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", width: "100%", transition: "all 0.3s", fontSize: "0.95rem" };