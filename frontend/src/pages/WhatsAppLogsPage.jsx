import { useEffect, useState } from "react";
import { listarWhatsAppLogs } from "../services/whatsappService";
import "./WhatsAppLogsPage.css";

export default function WhatsAppLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [telefono, setTelefono] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  async function cargarLogs(opts = {}) {
    try {
      setLoading(true);
      setError(null);
      const data = await listarWhatsAppLogs({
        telefono,
        fechaDesde,
        fechaHasta,
        page,
        pageSize,
        ...opts,
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los registros de WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarLogs();
  }, [page]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(1);
    cargarLogs({ page: 1 });
  };

  const handleLimpiar = () => {
    setTelefono("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    cargarLogs({ telefono: "", fechaDesde: "", fechaHasta: "", page: 1 });
  };

  return (
    <div className="wa-page">
      <div className="wa-card glass">
        <div className="wa-header">
          <h1>Historial de Envíos por WhatsApp</h1>
          <p className="wa-subtitle">
            Visualiza los envíos realizados, filtra por teléfono y fecha.
          </p>
        </div>

        <form className="wa-filters" onSubmit={handleBuscar}>
          <div className="wa-field">
            <label>Teléfono</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>

          <div className="wa-field">
            <label>Desde</label>
            <input
              type="datetime-local"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="wa-field">
            <label>Hasta</label>
            <input
              type="datetime-local"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="wa-actions">
            <button type="submit" className="btn-primary">
              Buscar
            </button>
            <button type="button" className="btn-secondary" onClick={handleLimpiar}>
              Limpiar
            </button>
          </div>
        </form>

        {loading ? (
          <div className="wa-loading">
            <div className="spinner"></div>
            <p>Cargando registros de WhatsApp...</p>
          </div>
        ) : error ? (
          <div className="wa-error">
            <p>{error}</p>
            <button onClick={() => cargarLogs()}>Reintentar</button>
          </div>
        ) : (
          <>
            <div className="wa-table-wrapper">
              <table className="wa-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Estudio</th>
                    <th>Teléfono</th>
                    <th>Mensaje</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-data">
                        No hay registros de WhatsApp
                      </td>
                    </tr>
                  ) : (
                    logs.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.estudio_id}</td>
                        <td>{item.telefono}</td>
                        <td className="mensaje-cell">{item.mensaje}</td>
                        <td className={`estado ${item.estado}`}>{item.estado}</td>
                        <td>{new Date(item.creado_en).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="wa-pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </button>
              <span>Página {page}</span>
              <button
                disabled={logs.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          </>
        )}

        <button className="volver-btn" onClick={() => window.history.back()}>
          ⬅ Volver
        </button>
      </div>
    </div>
  );
}