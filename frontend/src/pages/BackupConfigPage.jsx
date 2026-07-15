/**
 * BackupConfigPage.jsx — MI_PACS
 * Panel de Control del Ciclo de Vida, Copias de Seguridad y Purga Legal de DICOM
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

export default function BackupConfigPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  // Estados de control para el ciclo de vida de backups cortos
  const [diasMaduracion, setDiasMaduracion] = useState(30);
  const [nasRuta, setNasRuta] = useState("D:\\MI_PACS_NAS_EXTERNAL");
  const [copiaInternacional, setCopiaInternacional] = useState(true);
  
  // Modalidades de imagen (Incluyendo Arco en C: RF y XA)
  const [modalidades, setModalidades] = useState({
    CT: true, MR: true, DX: true, US: true, CR: false, MG: false, DXA: false, PET: false, RF: false, XA: false
  });

  // Estados para el control dinámico del Scheduler
  const [horaBackup, setHoraBackup] = useState("01:00");
  const [umbralPurga, setUmbralPurga] = useState(80);

  // 🔥 NUEVOS ESTADOS: Control de Purga Definitiva DICOM y Escudo Legal
  const [retencionLegalAnios, setRetencionLegalAnios] = useState(10);
  const [escudoPediatrico, setEscudoPediatrico] = useState(true);

  // Cargar configuraciones del servidor al montar la pantalla
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/admin/config", {
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
      .catch((err) => console.error("Error cargando parámetros del Scheduler:", err));
  }, [token]);

  // Guardar configuración en el servidor y reprogramar cron en caliente
  const handleGuardarConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    const modSeleccionadas = Object.keys(modalidades).filter(key => modalidades[key]);

    try {
      // 1. Guardar reglas de backup tradicionales
      const resBackup = await fetch("http://127.0.0.1:8000/api/backup/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dias_maduracion: diasMaduracion,
          modalidades: modSeleccionadas,
          nas_ruta: nasRuta,
          copia_internacional: copiaInternacional
        })
      });

      // 2. Guardar parámetros del planificador y PURGA LEGAL (Endpoint unificado)
      const resCron = await fetch("http://127.0.0.1:8000/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          hora_backup: horaBackup,
          umbral_purga: umbralPurga,
          retencion_legal_anios: retencionLegalAnios,
          escudo_pediatrico: escudoPediatrico
        })
      });

      if (resBackup.ok && resCron.ok) {
        setMensaje({ texto: "⚙️ Infraestructura, purga legal y ciclo de vida aplicados exitosamente.", tipo: "success" });
      } else {
        setMensaje({ texto: "Fallo al sincronizar los parámetros de red con el servidor.", tipo: "error" });
      }
    } catch (err) {
      setMensaje({ texto: "Error de conexión con el servidor.", tipo: "error" });
    } finally { setLoading(false); }
  };

  const handleForzarBackup = async () => {
    if (!window.confirm("¿Desea ejecutar la rutina de copias de seguridad selectivas en este instante?")) return;
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/backup/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMensaje({ texto: "🚀 " + data.message, tipo: "success" });
      } else {
        setMensaje({ texto: "Error: No se pudo iniciar el proceso.", tipo: "error" });
      }
    } catch (err) {
      setMensaje({ texto: "Error de red al disparar el proceso.", tipo: "error" });
    } finally { setLoading(false); }
  };

  // 🔥 NUEVA FUNCIÓN: Dispara el mantenimiento profundo (VACUUM) de SQLite
  const handleMantenimientoProfundo = async () => {
    if (!window.confirm("⚠️ ¿Desea iniciar el Mantenimiento Profundo?\nEsto eliminará registros huérfanos y compactará la base de datos. Puede causar lentitud temporal durante su ejecución.")) return;
    setLoading(true);
    setMensaje({ texto: "⏳ Ejecutando limpieza y optimización profunda (VACUUM)...", tipo: "info" });
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/admin/mantenimiento-profundo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMensaje({ texto: "✨ " + data.message, tipo: "success" });
      } else {
        setMensaje({ texto: "Error en el motor de base de datos durante el mantenimiento.", tipo: "error" });
      }
    } catch (err) {
      setMensaje({ texto: "Error de red al solicitar el mantenimiento.", tipo: "error" });
    } finally { setLoading(false); }
  };

  const handleCheckboxChange = (mod) => {
    setModalidades({ ...modalidades, [mod]: !modalidades[mod] });
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Gestión de Ciclo de Vida y Backups</h2>
      <p style={{ color: "#aaa", marginBottom: "25px" }}>
        Configure las reglas automáticas de retención legal, réplicas a NAS y reprogramación de limpieza.
      </p>

      {mensaje.texto && (
        <div style={{ ...alertStyle, backgroundColor: mensaje.tipo === "success" ? "#10b98122" : mensaje.tipo === "info" ? "#3b82f622" : "#ef444422", borderColor: mensaje.tipo === "success" ? "#10b981" : mensaje.tipo === "info" ? "#3b82f6" : "#ef4444" }}>
          {mensaje.texto}
        </div>
      )}

      <div style={gridLayout}>
        
        {/* ========================================================
            COLUMNA IZQUIERDA: CONFIGURACIÓN GENERAL 
            ======================================================== */}
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

            <label style={labelStyle}>Ruta de Destino NAS Externo (Archivos Vivos):</label>
            <input type="text" style={inputStyle} value={nasRuta} onChange={(e) => setNasRuta(e.target.value)} placeholder="Ej: Z:\MI_PACS_NAS" />

            {/* 🔥 NUEVO BLOQUE: ELIMINACIÓN DEFINITIVA Y ESCUDO PEDIÁTRICO */}
            <div style={legalBoxStyle}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f87171', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> Purga Definitiva DICOM (Cumplimiento Legal)
              </h4>
              <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '15px', lineHeight: '1.4' }}>
                Define cuándo se eliminarán definitivamente los archivos de imagen pesados. <strong>Nota: Los Reportes Clínicos (PDF) y el texto permanecerán por siempre en el sistema.</strong>
              </p>

              <label style={labelStyle}>Retención Legal para Adultos:</label>
              <select style={inputStyle} value={retencionLegalAnios} onChange={(e) => setRetencionLegalAnios(Number(e.target.value))}>
                <option value={5}>5 Años</option>
                <option value={10}>10 Años (Estándar Clínico)</option>
                <option value={15}>15 Años</option>
                <option value={20}>20 Años</option>
                <option value={999}>Nunca Eliminar (Retención Infinita)</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: escudoPediatrico ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "6px", border: escudoPediatrico ? "1px solid #10b981" : "1px solid #444", transition: 'all 0.3s' }}>
                <input type="checkbox" checked={escudoPediatrico} onChange={(e) => setEscudoPediatrico(e.target.checked)} style={{ accentColor: "#10b981", transform: "scale(1.2)" }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: "bold", color: escudoPediatrico ? '#10b981' : '#fff' }}>🛡️ Activar Escudo Legal Pediátrico</span>
                  <span style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '4px' }}>Bloquea dinámicamente la purga para menores de edad hasta que cumplan los 28 años (18 años + 10 años de retención).</span>
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
              <span style={{ fontWeight: "bold" }}>Activar Réplica en Nube (Protección de Desastres)</span>
            </label>

            <button type="submit" disabled={loading} style={btnGuardarStyle}>
              {loading ? "Aplicando Reglas..." : "Guardar Configuración General"}
            </button>
          </form>
        </div>

        {/* ========================================================
            COLUMNA DERECHA: ACCIONES EN TIEMPO REAL 
            ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card del Planificador */}
          <div style={cardStyle}>
            <h3 style={sectionTitle}>⚡ Rutina Diaria (Cron)</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "15px" }}>
              La rutina automática realiza la copia a NAS, replica a la nube y purga archivos que hayan caducado legalmente.
            </p>

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

          {/* 🔥 NUEVO: Card de Mantenimiento de Base de Datos */}
          <div style={cardStyle}>
            <h3 style={{...sectionTitle, color: '#f87171'}}>🧹 Mantenimiento del Sistema</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "15px", lineHeight: '1.4' }}>
              Al purgar miles de archivos DICOM viejos, la base de datos SQLite puede generar "huecos" vacíos. Esta herramienta compacta el archivo físico, reconstruye índices y mejora la velocidad de búsqueda.
            </p>

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

        </div>
      </div>
    </div>
  );
}

// =========================================================
// ESTILOS DE INTERFAZ
// =========================================================
const containerStyle = { padding: "30px", color: "white", backgroundColor: "#0f1114", height: "100vh", width: "100%", boxSizing: "border-box", overflowY: "auto" };
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