import { useEffect, useState } from "react";
import { listarEmailLogs } from "../services/emailLogsService";
import "./EmailLogsPage.css";

export default function EmailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await listarEmailLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los logs de email.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  if (loading) {
    return (
      <div className="email-loading">
        <div className="spinner"></div>
        <p>Cargando logs de email...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="email-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="email-container">
      {/* Título Dorado exactamente como en Auditoría */}
      <h1 className="email-title" style={{ color: "#FFD700", marginBottom: "20px" }}>
        Logs de Envío de Email
      </h1>

      {/* Bloque interno corregido: Sin fondo blanco, ahora es gris oscuro coherente */}
      <div className="email-card" style={{ 
        backgroundColor: "#1e222d", 
        padding: "20px", 
        borderRadius: "8px", 
        border: "1px solid #333" 
      }}>
        <table className="email-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #444" }}>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>ID</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Paciente</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Estudio</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Email</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Formato</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Estado</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#FFD700" }}>Fecha</th>
            </tr>
          </thead>

          <tbody style={{ color: "#d1d1d1" }}>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data" style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                  No hay registros de email
                </td>
              </tr>
            ) : (
              logs.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #2a2e3d" }}>
                  <td style={{ padding: "12px" }}>{item.id}</td>
                  <td style={{ padding: "12px", fontWeight: "bold" }}>{item.paciente_nombre || "Sin nombre"}</td>
                  <td style={{ padding: "12px" }}>{item.estudio_id}</td>
                  <td style={{ padding: "12px" }}>{item.email}</td>
                  <td style={{ padding: "12px" }}>{item.formato}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{
                      color: item.estado === "enviado" ? "#4caf50" : "#f44336",
                      fontWeight: "bold"
                    }}>
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>{new Date(item.fecha).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button className="volver-btn" onClick={() => window.history.back()} style={{ marginTop: "20px" }}>
        ⬅ Volver
      </button>
    </div>
  );
}