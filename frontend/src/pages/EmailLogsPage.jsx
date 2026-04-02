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
      <h1 className="email-title">Logs de Envío de Email</h1>

      <table className="email-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Estudio</th>
            <th>Email</th>
            <th>Formato</th>
            <th>Estado</th>
            <th>Fecha</th>
          </tr>
        </thead>

        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan="6" className="no-data">
                No hay registros de email
              </td>
            </tr>
          ) : (
            logs.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.estudio_id}</td>
                <td>{item.email}</td>
                <td>{item.formato}</td>
                <td className={`estado ${item.estado}`}>{item.estado}</td>
                <td>{new Date(item.fecha).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <button className="volver-btn" onClick={() => window.history.back()}>
        ⬅ Volver
      </button>
    </div>
  );
}