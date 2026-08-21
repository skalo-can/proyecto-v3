/**
 * BackupConfigPage.jsx — MI_PACS
 * Panel de Control del Ciclo de Vida, Copias de Seguridad y Purga Legal de DICOM
 */

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";

export default function BackupConfigPage() {
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
            setMensaje({ texto: `✅ Operación finalizada exitosamente.`, tipo: "success" });
            
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
        setMensaje({ texto: "⚙️ Infraestructura y ciclo de vida aplicados exitosamente.", tipo: "success" });
      } else {
        setMensaje({ texto: "Fallo al sincronizar los parámetros.", tipo: "error" });
      }
    } catch (err) {
      setMensaje({ texto: "Error de conexión.", tipo: "error" });
    } finally { setLoading(false); }
  };

  const handleForzarBackup = async () => {
    if (!window.confirm("¿Desea ejecutar la rutina de copias de seguridad en este instante?")) return;
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
        setMensaje({ texto: "Error: No se pudo iniciar el proceso.", tipo: "error" });
        setLoading(false);
      }
    } catch (err) {
      setMensaje({ texto: "Error de red al disparar el proceso.", tipo: "error" });
      setLoading(false);
    }
  };

  const handleMantenimientoProfundo = async () => {
    if (!window.confirm("⚠️ ¿Desea iniciar el Mantenimiento Profundo?\nEsto compactará la base de datos y mejorará la velocidad.")) return;
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
        setMensaje({ texto: "Error en el motor de base de datos.", tipo: "error" });
        setLoading(false);
      }
    } catch (err) {
      setMensaje({ texto: "Error de red al solicitar el mantenimiento.", tipo: "error" });
      setLoading(false);
    }
  };

  // 🚀 LÓGICA DE CANCELACIÓN
  const handleCancelarRutina = async () => {
    if (!window.confirm("¿Está seguro de que desea detener el proceso en curso?")) return;
    try {
        await fetch("http://192.168.5.21:8000/api/admin/cancelar-rutina", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        setMensaje({ texto: "🛑 Orden de cancelación enviada al servidor.", tipo: "info" });
    } catch (err) {
        alert("❌ Error de red al cancelar.");
    }
  };

  const handleCheckboxChange = (mod) => {
    setModalidades({ ...modalidades, [mod]: !modalidades[mod] });
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Gestión de Ciclo de Vida y Backups</h2>
      <p style={{ color: "#aaa", marginBottom: "25px" }}>
        Configure las reglas automáticas de retención legal, réplicas a NAS y limpieza.
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
                      📊 {progresoRutina.operacion === "vacuum" ? "MANTENIMIENTO PROFUNDO EN CURSO" : "RUTINA DE BACKUP / PURGA EN CURSO"}
                  </h3>
                  <button onClick={handleCancelarRutina} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🛑 Cancelar Proceso</button>
              </div>
              <div style={{ display: 'flex', gap: '30px', color: '#fff', fontSize: '0.9rem' }}>
                  <div>📁 Tareas Detectadas: <strong style={{ color: '#fbbf24' }}>{progresoRutina.total_detectados}</strong></div>
                  <div>✅ Completadas: <strong style={{ color: '#10b981' }}>{progresoRutina.exitosos}</strong></div>
                  <div>⚠️ Errores: <strong style={{ color: '#ef4444' }}>{progresoRutina.fallidos}</strong></div>
              </div>
              <div style={{ backgroundColor: '#222', height: '10px', borderRadius: '5px', marginTop: '15px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#10b981', height: '100%', width: `${progresoRutina.total_detectados > 0 ? (progresoRutina.exitosos / progresoRutina.total_detectados) * 100 : 0}%`, transition: 'width 0.3s ease' }}></div>
              </div>
          </div>
      )}

      <div style={gridLayout}>
        
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN GENERAL */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>⚙️ Reglas de Almacenamiento NAS y Nube</h3>
          <form onSubmit={handleGuardarConfig}>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Maduración (Paso de Local a NAS):</label>
                <select style={inputStyle} value={diasMaduracion} onChange={(e) => setDiasMaduracion(Number(e.target.value))}>
                  <option value={15}>15 Días (Flujo Rápido)</option>
                  <option value={20}>20 Días (Estándar)</option>
                  <option value={30}>30 Días (Recomendado)</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Hora de Rutina (Cron):</label>
                <input type="time" style={inputStyle} value={horaBackup} onChange={(e) => setHoraBackup(e.target.value)} />
              </div>
            </div>

            <label style={labelStyle}>Ruta de Destino NAS Externo:</label>
            <input type="text" style={inputStyle} value={nasRuta} onChange={(e) => setNasRuta(e.target.value)} placeholder="Ej: Z:\MI_PACS_NAS" />

            <div style={legalBoxStyle}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f87171', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> Purga Definitiva DICOM (Cumplimiento Legal)
              </h4>
              <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '15px', lineHeight: '1.4' }}>
                Define cuándo se eliminarán definitivamente los archivos de imagen pesados.
              </p>

              <label style={labelStyle}>Retención Legal para Adultos:</label>
              <select style={inputStyle} value={retencionLegalAnios} onChange={(e) => setRetencionLegalAnios(Number(e.target.value))}>
                <option value={5}>5 Años</option>
                <option value={10}>10 Años (Estándar Clínico)</option>
                <option value={15}>15 Años</option>
                <option value={20}>20 Años</option>
                <option value={999}>Nunca Eliminar</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: escudoPediatrico ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "6px", border: escudoPediatrico ? "1px solid #10b981" : "1px solid #444", transition: 'all 0.3s' }}>
                <input type="checkbox" checked={escudoPediatrico} onChange={(e) => setEscudoPediatrico(e.target.checked)} style={{ accentColor: "#10b981", transform: "scale(1.2)" }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: "bold", color: escudoPediatrico ? '#10b981' : '#fff' }}>🛡️ Activar Escudo Legal Pediátrico</span>
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
              <span style={{ fontWeight: "bold" }}>Activar Réplica en Nube</span>
            </label>

            <button type="submit" disabled={loading} style={btnGuardarStyle}>
              {loading ? "Aplicando..." : "Guardar Configuración General"}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: ACCIONES EN TIEMPO REAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={cardStyle}>
            <h3 style={sectionTitle}>⚡ Rutina Diaria (Cron)</h3>
            <div style={{ padding: "15px", background: "#000", borderRadius: "8px", border: "1px solid #222", marginBottom: "20px" }}>
              <span style={{ color: "#888", fontSize: "0.8rem", display: "block" }}>ESTADO DEL ROBOT DE LIMPIEZA</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#10b981", boxShadow: "0 0 8px #10b981" }}></div>
                <strong style={{ color: "#fff" }}>Armado (Se ejecutará a las {horaBackup})</strong>
              </div>
            </div>
            <button onClick={handleForzarBackup} disabled={loading} style={btnForzarStyle}>
              Ejecutar Rutina Ahora Mismo
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{...sectionTitle, color: '#f87171'}}>🧹 Mantenimiento del Sistema</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.5rem' }}>🗜️</span>
              <div>
                <span style={{ display: 'block', color: '#f87171', fontWeight: 'bold', fontSize: '0.9rem' }}>Aspiradora de Base de Datos (VACUUM)</span>
                <span style={{ color: '#aaa', fontSize: '0.75rem' }}>Uso sugerido: 1 vez al mes.</span>
              </div>
            </div>
            <button onClick={handleMantenimientoProfundo} disabled={loading} style={{...btnForzarStyle, borderColor: '#f87171', color: '#f87171'}}>
              Iniciar Optimización Profunda
            </button>
          </div>

          {/* PURGA DE IMPORTADOS */}
          <div style={cardStyle}>
            <h3 style={{ color: '#f87171', marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: "1px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
              🧹 Limpieza de Estudios Externos
            </h3>
            
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: desbloquearPurga ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "6px", border: desbloquearPurga ? "1px solid #ef4444" : "1px solid #444", transition: 'all 0.3s', marginBottom: '15px' }}>
              <input type="checkbox" checked={desbloquearPurga} onChange={(e) => setDesbloquearPurga(e.target.checked)} style={{ accentColor: "#ef4444", transform: "scale(1.2)" }} />
              <span style={{ fontWeight: "bold", color: desbloquearPurga ? '#ef4444' : '#fff', fontSize: '0.9rem' }}>
                {desbloquearPurga ? "🔓 Purga Desbloqueada" : "🔒 Autorizar uso de esta herramienta"}
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#0a0c0f', padding: '15px', borderRadius: '8px', border: '1px solid #222', opacity: desbloquearPurga ? 1 : 0.5, pointerEvents: desbloquearPurga ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                  Retención para Externos:
                </label>
                <select id="dias_retencion" style={{ background: '#111418', color: '#fbbf24', border: '1px solid #333', padding: '8px 12px', borderRadius: '6px', width: '100%', fontFamily: 'monospace' }} defaultValue="30">
                  <option value="15">15 Días</option>
                  <option value="30">30 Días (Recomendado)</option>
                  <option value="60">60 Días</option>
                  <option value="90">90 Días</option>
                </select>
              </div>

              <button 
                disabled={!desbloquearPurga}
                onClick={async () => {
                  if(window.confirm("⚠️ ADVERTENCIA: Esta acción eliminará permanentemente los archivos DICOM. ¿Desea continuar?")) {
                    const dias = document.getElementById("dias_retencion").value;
                    try {
                      const res = await fetch(`http://192.168.5.21:8000/api/purgar-importados?dias_retencion=${dias}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const data = await res.json();
                      if(res.ok) {
                        alert(`✅ Éxito: ${data.mensaje}`);
                        setDesbloquearPurga(false); 
                      } else {
                        alert(`❌ Error: ${data.detail}`);
                      }
                    } catch(e) {
                      alert("❌ Fallo de conexión.");
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
                🗑️ Ejecutar Purga Ahora
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