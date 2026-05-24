/**
 * BackupConfigPage.jsx — MI_PACS
 * Panel de Control del Ciclo de Vida y Copias de Seguridad Dinámicas
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

export default function BackupConfigPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  // Estados de control para el ciclo de vida
  const [diasMaduracion, setDiasMaduracion] = useState(30);
  const [nasRuta, setNasRuta] = useState("D:\\MI_PACS_NAS_EXTERNAL");
  const [copiaInternacional, setCopiaInternacional] = useState(true);
  
  // 🚀 ACTUALIZADO: Estándar DX y nuevas modalidades (CR, DXA, PET)
  const [modalidades, setModalidades] = useState({
    CT: true, MR: true, DX: true, US: true, MG: false, CR: false, DXA: false, PET: false
  });

  // 🚀 NUEVO: Estados para el control dinámico del Scheduler de la API unificada
  const [horaBackup, setHoraBackup] = useState("01:00");
  const [umbralPurga, setUmbralPurga] = useState(80);

  // Cargar configuraciones del planificador dinámico al montar la pantalla
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/admin/config", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setHoraBackup(data.hora_backup || "01:00");
          setUmbralPurga(data.umbral_purga || 80);
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
      // 1. Guardar reglas de almacenamiento tradicionales
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

      // 2. Guardar parámetros de tiempo y purga en el nuevo endpoint unificado
      const resCron = await fetch("http://127.0.0.1:8000/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          hora_backup: horaBackup,
          umbral_purga: umbralPurga
        })
      });

      if (resBackup.ok && resCron.ok) {
        setMensaje({ texto: "⚙️ Infraestructura y ciclo de vida aplicados. Planificador reprogramado.", tipo: "success" });
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

  const handleCheckboxChange = (mod) => {
    setModalidades({ ...modalidades, [mod]: !modalidades[mod] });
  };

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Gestión de Ciclo de Vida y Backups</h2>
      <p style={{ color: "#aaa", marginBottom: "25px" }}>
        Configure las reglas automáticas de maduración de datos, réplicas y reprogramación de la pasarela del planificador.
      </p>

      {mensaje.texto && (
        <div style={{ ...alertStyle, backgroundColor: mensaje.tipo === "success" ? "#10b98122" : "#ef444422", borderColor: mensaje.tipo === "success" ? "#10b981" : "#ef4444" }}>
          {mensaje.texto}
        </div>
      )}

      <div style={gridLayout}>
        {/* Formulario de Reglas */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>⚙️ Reglas de Almacenamiento</h3>
          <form onSubmit={handleGuardarConfig}>
            <label style={labelStyle}>Tiempo de Maduración (Espera Post-Estudio):</label>
            <select style={inputStyle} value={diasMaduracion} onChange={(e) => setDiasMaduracion(Number(e.target.value))}>
              <option value={15}>15 Días (Flujo Rápido)</option>
              <option value={20}>20 Días (Flujo Estándar)</option>
              <option value={30}>30 Días (Seguridad Recomendada)</option>
            </select>

            {/* 🚀 NUEVO: Input de tiempo dinámico para reprogramar la ejecución */}
            <label style={labelStyle}>Hora de Ejecución de la Rutina (Formato 24H):</label>
            <input type="time" style={inputStyle} value={horaBackup} onChange={(e) => setHoraBackup(e.target.value)} />

            {/* 🚀 NUEVO: Control dinámico del porcentaje de Purga Segura */}
            <label style={labelStyle}>Umbral Máximo de Purga Segura Local (%):</label>
            <input type="number" min="50" max="95" style={inputStyle} value={umbralPurga} onChange={(e) => setUmbralPurga(parseInt(e.target.value))} />

            <label style={labelStyle}>Ruta de Destino NAS Externo:</label>
            <input type="text" style={inputStyle} value={nasRuta} onChange={(e) => setNasRuta(e.target.value)} />

            <label style={labelStyle}>Selección de Modalidades Incluidas:</label>
            <div style={{ display: "flex", gap: "12px", margin: "10px 0 20px 0", flexWrap: "wrap" }}>
              {Object.keys(modalidades).map((mod) => (
                <label key={mod} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#ddd", background: "#0a0c0f", padding: "6px 12px", borderRadius: "6px", border: "1px solid #222" }}>
                  <input type="checkbox" checked={modalidades[mod]} onChange={() => handleCheckboxChange(mod)} style={{ accentColor: "#fbbf24" }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: "600" }}>{mod}</span>
                </label>
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "25px" }}>
              <input type="checkbox" checked={copiaInternacional} onChange={() => setCopiaInternacional(!copiaInternacional)} style={{ accentColor: "#fbbf24" }} />
              <span style={{ fontWeight: "bold" }}>Activar Réplica Segura fuera del país (Protección Geográfica)</span>
            </label>

            <button type="submit" disabled={loading} style={btnGuardarStyle}>
              {loading ? "Aplicando..." : "Guardar Configuración"}
            </button>
          </form>
        </div>

        {/* Panel de Pruebas Rápidas */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>⚡ Acciones Inmediatas</h3>
          <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "20px" }}>
            Use estas herramientas para verificar la conectividad de los almacenes o forzar respaldos temporales fuera de horario.
          </p>

          <div style={{ padding: "15px", background: "#000", borderRadius: "8px", border: "1px solid #222", marginBottom: "20px" }}>
            <span style={{ color: "#888", fontSize: "0.8rem", display: "block" }}>ESTADO DEL PLANIFICADOR</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#10b981" }}></div>
              <strong style={{ color: "#fff" }}>Servicio Activo ({horaBackup} Daily)</strong>
            </div>
          </div>

          <button onClick={handleForzarBackup} disabled={loading} style={btnForzarStyle}>
            Ejecutar Tarea de Backup Ahora
          </button>
        </div>
      </div>
    </div>
  );
}

// Estilos consistentes con MI_PACS oscuros
const containerStyle = { padding: "20px", color: "white", backgroundColor: "#0f1114", height: "100vh", width: "100%", boxSizing: "border-box", overflowY: "auto" };
const titleStyle = { color: "#fbbf24", marginBottom: "5px", borderLeft: "4px solid #fbbf24", paddingLeft: "15px" };
const gridLayout = { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px", marginTop: "20px" };
const cardStyle = { background: "#1a1d21", padding: "25px", borderRadius: "12px", border: "1px solid #333" };
const sectionTitle = { color: "#fbbf24", fontSize: "1.2rem", marginBottom: "20px", borderBottom: "1px solid #222", paddingBottom: "10px" };
const labelStyle = { color: "#aaa", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px", display: "block" };
const inputStyle = { background: "#000", border: "1px solid #444", color: "#fff", padding: "10px", borderRadius: "6px", width: "100%", boxSizing: "border-box", marginBottom: "20px", fontSize: "0.9rem" };
const alertStyle = { padding: "15px", borderRadius: "8px", border: "1px solid", marginBottom: "20px", color: "#fff", fontSize: "0.9rem" };
const btnGuardarStyle = { background: "#fbbf24", color: "#000", border: "none", padding: "12px 25px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", width: "100%" };
const btnForzarStyle = { background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "12px 25px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", width: "100%", transition: "all 0.3s" };