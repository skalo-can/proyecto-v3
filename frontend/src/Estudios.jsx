import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

function Estudios() {
  const { id } = useParams(); // ID del paciente
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const apiBase =
    window.API_URL ||
    (window.location.origin.includes(":5173")
      ? "http://192.168.5.21:8000"
      : window.location.origin);

  useEffect(() => {
    const fetchEstudios = async () => {
      try {
        const response = await fetch(
          `${apiBase}/api/estudios/paciente/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        setEstudios(data || []);
      } catch (error) {
        console.error("Error cargando estudios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEstudios();
  }, [id, token, apiBase]);

  const irAImagenes = (estudioId) => {
    navigate(`/imagenes-estudio/${estudioId}`);
  };

  const traducirEstado = (estado) => {
    if (!estado) return "";
    const clave = String(estado).toLowerCase().trim();
    return t(`estados.${clave}`, estado);
  };

  return (
    <div className="estudios-container">
      <h2>
        {isEn ? `Patient Studies #${id}` : `Estudios del Paciente #${id}`}
      </h2>

      <div className="acciones-superiores">
        <button className="btn-config" onClick={() => navigate("/pacientes")}>
          {isEn ? "Back to Patients" : "Volver a Pacientes"}
        </button>
      </div>

      {loading && (
        <p>{isEn ? "Loading studies..." : "Cargando estudios..."}</p>
      )}

      {!loading && estudios.length === 0 && (
        <p className="mensaje-vacio">
          {isEn ? "No registered studies found." : "No hay estudios registrados."}
        </p>
      )}

      {!loading && estudios.length > 0 && (
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th>ID</th>
              <th>{isEn ? "Type" : "Tipo"}</th>
              <th>{isEn ? "Date" : "Fecha"}</th>
              <th>UID</th>
              <th>{isEn ? "Description" : "Descripción"}</th>
              <th>{isEn ? "Status" : "Estado"}</th>
              <th>{isEn ? "Actions" : "Acciones"}</th>
            </tr>
          </thead>

          <tbody>
            {estudios.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.tipo_estudio}</td>
                <td>{e.fecha_estudio}</td>
                <td>{e.uid}</td>
                <td>{e.descripcion}</td>
                <td>{traducirEstado(e.estado)}</td>
                <td>
                  <button
                    className="btn-primario"
                    onClick={() => irAImagenes(e.id)}
                  >
                    {isEn ? "View Images" : "Ver imágenes"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Estudios;