import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function Estudios() {
  const { id } = useParams(); // ID del paciente
  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchEstudios = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/estudios/paciente/${id}`,
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
  }, [id, token]);

  const irAImagenes = (estudioId) => {
    navigate(`/imagenes-estudio/${estudioId}`);
  };

  return (
    <div className="estudios-container">
      <h2>Estudios del Paciente #{id}</h2>

      <div className="acciones-superiores">
        <button className="btn-config" onClick={() => navigate("/pacientes")}>
          Volver a Pacientes
        </button>
      </div>

      {loading && <p>Cargando estudios...</p>}

      {!loading && estudios.length === 0 && (
        <p className="mensaje-vacio">No hay estudios registrados.</p>
      )}

      {!loading && estudios.length > 0 && (
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>UID</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                <td>{e.estado}</td>
                <td>
                  <button
                    className="btn-primario"
                    onClick={() => irAImagenes(e.id)}
                  >
                    Ver imágenes
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