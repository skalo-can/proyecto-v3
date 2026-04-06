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

  if (loading) return <div className="auditoria-loading"><p>Cargando...</p></div>;
  if (error) return <div className="auditoria-error"><p>{error}</p></div>;

  return (
    <div className="auditoria-container">
      {/* Título principal */}
      <h1 className="auditoria-title">Auditoría de Descargas</h1>

      {/* Contenedor oscuro con scroll interno */}
      <div className="auditoria-card">
        <table className="auditoria-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Paciente</th>
              <th>Estudio</th>
              <th>IP</th>
              <th>Resultado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {auditoria.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">No hay registros de auditoría</td>
              </tr>
            ) : (
              auditoria.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td className="paciente-nombre">{item.paciente_nombre || "Sin nombre"}</td>
                  <td>{item.estudio_id}</td>
                  <td>{item.ip}</td>
                  <td>
                    <span className={`estado-badge ${item.estado}`}>
                      {item.estado}
                    </span>
                  </td>
                  <td>{new Date(item.fecha).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button className="volver-btn" onClick={() => window.history.back()}>
        ⬅ Volver
      </button>
    </div>
  );
}