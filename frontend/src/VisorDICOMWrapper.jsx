import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

function VisorDICOMWrapper() {
  const { estudioId } = useParams();
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchImagenes = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/estudios/${estudioId}/imagenes`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        setImagenes(data || []);
      } catch (error) {
        console.error("Error cargando imágenes del estudio:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImagenes();
  }, [estudioId, token]);

  const abrirVisor = (ruta) => {
    // Aquí puedes integrar tu visor DICOM real (OHIF, Cornerstone, etc.)
    // Por ahora abrimos la imagen directamente en una nueva pestaña.
    window.open(`http://127.0.0.1:8000/${ruta}`, "_blank");
  };

  return (
    <div className="visor-container">
      <h2>Visor DICOM — Estudio #{estudioId}</h2>

      <div className="acciones-superiores">
        <button className="btn-config" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>

      {loading && <p>Cargando imágenes...</p>}

      {!loading && imagenes.length === 0 && (
        <p className="mensaje-vacio">No hay imágenes registradas para este estudio.</p>
      )}

      {!loading && imagenes.length > 0 && (
        <div className="imagenes-grid">
          {imagenes.map((img) => (
            <div key={img.id} className="imagen-item">
              <img
                src={`http://127.0.0.1:8000/${img.ruta_archivo}`}
                alt="Miniatura DICOM"
                className="thumbnail-dicom"
                onClick={() => abrirVisor(img.ruta_archivo)}
              />
              <p className="imagen-label">Imagen #{img.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VisorDICOMWrapper;