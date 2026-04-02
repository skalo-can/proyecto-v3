import { useEffect, useState } from "react";
import { revocarLinkSeguro } from "../services/secureLinksService";
import { listarEnlacesSeguros } from "../services/secureLinksService";
import "./SecureLinksPage.css";

export default function SecureLinksPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function cargarLinks() {
    try {
      setLoading(true);
      const data = await listarEnlacesSeguros();
      setLinks(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los enlaces seguros.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarLinks();
  }, []);

  const handleRevocar = async (token) => {
    if (!confirm("¿Seguro que deseas revocar este enlace?")) return;

    try {
      await revocarLinkSeguro(token);
      alert("Enlace revocado correctamente.");
      cargarLinks();
    } catch (err) {
      console.error(err);
      alert("Error revocando el enlace.");
    }
  };

  if (loading) {
    return (
      <div className="secure-loading">
        <div className="spinner"></div>
        <p>Cargando enlaces seguros...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="secure-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="secure-container">
      <h1 className="secure-title">Enlaces Seguros Generados</h1>

      <table className="secure-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Estudio</th>
            <th>Descargas</th>
            <th>Expira</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>

        <tbody>
          {links.length === 0 ? (
            <tr>
              <td colSpan="6" className="no-data">
                No hay enlaces generados
              </td>
            </tr>
          ) : (
            links.map((item) => (
              <tr key={item.token}>
                <td>{item.token}</td>
                <td>{item.estudio_id}</td>
                <td>{item.descargas}</td>
                <td>{new Date(item.expira).toLocaleString()}</td>
                <td className={`estado ${item.estado}`}>{item.estado}</td>
                <td>
                  {item.estado === "activo" ? (
                    <button
                      className="revocar-btn"
                      onClick={() => handleRevocar(item.token)}
                    >
                      Revocar
                    </button>
                  ) : (
                    <span className="disabled">—</span>
                  )}
                </td>
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