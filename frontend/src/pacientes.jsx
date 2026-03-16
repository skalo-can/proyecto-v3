import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const token = localStorage.getItem("token");

  // ---------------------------------------------------------
  // CARGAR PACIENTES
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/pacientes", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        setPacientes(data || []);
      } catch (error) {
        console.error("Error cargando pacientes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPacientes();
  }, [token]);

  const irAEstudios = (id) => {
    navigate(`/pacientes/${id}/estudios`);
  };

  // ---------------------------------------------------------
  // RESETEAR BASE DE DATOS
  // ---------------------------------------------------------
  const resetearBD = async () => {
    if (!window.confirm("¿Seguro que deseas resetear MI_PACS?")) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/api/reset/clinico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      alert(data.mensaje || "Reset completado");

      // Recargar lista de pacientes
      setPacientes([]);
    } catch (error) {
      console.error("Error al resetear BD:", error);
      alert("Error al resetear la base de datos");
    }
  };

  // ---------------------------------------------------------
  // CONFIGURACIÓN MI_PACS
  // ---------------------------------------------------------
  const abrirConfiguracion = () => {
    navigate("/configuracion"); // ← Debes tener una ruta Configuracion.jsx
  };

  return (
    <div className="pacientes-container">
      <h2>Lista de Pacientes</h2>

      {/* BOTONES SUPERIORES */}
      <div className="acciones-superiores">
        <button
          className="btn-primario"
          onClick={() => {
            logout();
            localStorage.clear();
            navigate("/", { replace: true });
          }}
        >
          Cerrar sesión
        </button>

        <button className="btn-secundario" onClick={resetearBD}>
          Resetear Base de Datos
        </button>

        <button className="btn-config" onClick={abrirConfiguracion}>
          Configuración MI_PACS
        </button>
      </div>

      {/* ESTADO DE CARGA */}
      {loading && <p>Cargando pacientes...</p>}

      {/* LISTA VACÍA */}
      {!loading && pacientes.length === 0 && (
        <p style={{ marginTop: "20px", fontStyle: "italic", color: "#666" }}>
          No hay pacientes registrados.
        </p>
      )}

      {/* LISTA DE PACIENTES */}
      {!loading && pacientes.length > 0 && (
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.nombre}</td>
                <td>
                  <button onClick={() => irAEstudios(p.id)}>
                    Ver estudios
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

export default Pacientes;