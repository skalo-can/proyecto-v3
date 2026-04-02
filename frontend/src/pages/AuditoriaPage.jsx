import { useEffect, useState } from "react";
import { listarAuditoria } from "../services/auditoriaService";
import "./AuditoriaPage.css";

export default function AuditoriaPage() {
  const [auditoria, setAuditoria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await listarAuditoria();
        setAuditoria(data);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la auditoría.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  if (loading) {
    return (
      <div className="auditoria-loading">
        <div className="spinner"></div>
        <p>Cargando auditoría...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auditoria-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="auditoria-container">
      <h1 className="auditoria-title">Auditoría de Descargas</h1>

      <table className="auditoria-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Estudio</th>
            <th>IP</th>
            <th>Resultado</th>
            <th>Fecha</th>
          </tr>
        </thead>

        <tbody>
          {auditoria.length === 0 ? (
            <tr>
              <td colSpan="5" className="no-data">
                No hay registros de auditoría
              </td>
            </tr>
          ) : (
            auditoria.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.estudio_id}</td>
                <td>{item.ip}</td>
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