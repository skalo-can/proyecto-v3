/**
 * ImagenesEstudio.jsx — MI_PACS
 * HUB clínico de visualización para estudios médicos.
 */

import { useEffect, useState } from "react";
import VisorDICOM from "./VisorDICOM";
import MPRViewer from "./MPRViewer";
import CompareViewer from "./CompareViewer";
import ViewerContainer from "./ViewerContainer";

export default function ImagenesEstudio({ estudioId, onVolver, onVolverPacientes }) {
  const [imagenes, setImagenes] = useState([]);
  const [listaDeImagenes, setListaDeImagenes] = useState([]);
  const [urlSeleccionada, setUrlSeleccionada] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarVisor, setMostrarVisor] = useState(false);
  const [mostrarMPR, setMostrarMPR] = useState(false);
  const [mostrarComparacion, setMostrarComparacion] = useState(null);

  const [iaResultado, setIaResultado] = useState(null);

  // ---------------------------------------------------------
  // Cargar imágenes del estudio desde backend clínico
  // ---------------------------------------------------------
  useEffect(() => {
    if (!estudioId) return;

    console.log("MI_PACS → Cargando imágenes del estudio:", estudioId);

    setLoading(true);
    setError(null);

    fetch(`http://192.168.5.21:8000/api/estudios/${estudioId}/imagenes`)
      .then((res) => res.json())
      .then((data) => {
        console.log("MI_PACS → Respuesta del backend:", data);

        setImagenes(data);

        // Extraer URLs DICOM reales
        const urls = data
          .filter((img) => img.tipo === "dcm" && img.ruta_archivo)
          .map((img) => {
            const ruta = img.ruta_archivo.startsWith("/")
              ? `http://192.168.5.21:8000${img.ruta_archivo}`
              : `http://192.168.5.21:8000/${img.ruta_archivo}`;
            return ruta;
          });

        setListaDeImagenes(urls);

        console.log("MI_PACS → URLs DICOM detectadas:", urls);
      })
      .catch((err) => {
        console.error("MI_PACS → Error cargando imágenes:", err);
        setError("No se pudieron cargar las imágenes.");
      })
      .finally(() => setLoading(false));
  }, [estudioId]);

  // ---------------------------------------------------------
  // Comparación con estudio previo (Lógica actualizada Historial eFilm)
  // ---------------------------------------------------------
  async function compararConPrevio() {
    try {
      console.log("MI_PACS → Solicitando estudio previo…");

      const res = await fetch(`http://192.168.5.21:8000/api/estudios/${estudioId}/previo`);
      const data = await res.json();

      if (!data || !data.id) {
        alert("Este paciente no tiene estudios previos para comparar.");
        return;
      }

      const resPrevio = await fetch(
        `http://192.168.5.21:8000/api/estudios/${data.id}/imagenes`
      );
      const imgsPrevio = await resPrevio.json();

      const urlsPrevio = imgsPrevio
        .filter((img) => img.tipo === "dcm" && img.ruta_archivo)
        .map((img) => {
          const ruta = img.ruta_archivo.startsWith("/")
            ? `http://192.168.5.21:8000${img.ruta_archivo}`
            : `http://192.168.5.21:8000/${img.ruta_archivo}`;
          return ruta;
        });

      // 🔥 APAGAMOS EL VISOR NORMAL Y ENCENDEMOS LA COMPARACIÓN
      setMostrarVisor(false);
      setMostrarComparacion({
        actual: listaDeImagenes,
        previo: urlsPrevio,
      });

      console.log("MI_PACS → Comparación lista.");
    } catch {
      alert("No se pudo comparar con el estudio previo.");
    }
  }

  // ---------------------------------------------------------
  // Renderizado de visualizadores clínicos
  // ---------------------------------------------------------
  
  // 1. Primero evaluamos si debe mostrar la comparación
  if (mostrarComparacion) {
    return (
      <CompareViewer
        urlsA={mostrarComparacion.actual}
        urlsB={mostrarComparacion.previo}
        iaResultado={iaResultado}
        onVolver={() => {
          setMostrarComparacion(null);
          setMostrarVisor(true); // 🔥 Regresa al visor normal sin cerrar todo
        }}
      />
    );
  }

  // 2. Si no está en comparación, evaluamos si debe mostrar el visor normal
  if (mostrarVisor) {
    return (
      <VisorDICOM
        urls={listaDeImagenes}
        modo="medico"
        iaResultado={iaResultado}
        onVolver={() => setMostrarVisor(false)}
        onToggleHistory={compararConPrevio} // 🔗 AQUÍ CONECTAMOS EL BOTÓN PREMIUM
      />
    );
  }

  // 3. Evaluamos MPR
  if (mostrarMPR) {
    return (
      <MPRViewer
        urls={listaDeImagenes}
        iaResultado={iaResultado}
        onVolver={() => setMostrarMPR(false)}
      />
    );
  }

  if (urlSeleccionada) {
    return <ViewerContainer url={urlSeleccionada} />;
  }

  // ---------------------------------------------------------
  // Lista de imágenes con miniaturas + doble click (Galería)
  // ---------------------------------------------------------
  return (
    <div style={{ padding: "20px" }}>
      <button onClick={onVolver}>← Volver a estudios</button>
      <button onClick={onVolverPacientes} style={{ marginLeft: "10px" }}>
        ← Volver a pacientes
      </button>

      <h2>Imágenes del estudio {estudioId}</h2>

      {loading && <p>Cargando imágenes...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {listaDeImagenes.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <button onClick={() => setMostrarVisor(true)}>Abrir visor DICOM</button>
          <button onClick={() => setMostrarMPR(true)} style={{ marginLeft: "10px" }}>
            Ver en MPR
          </button>
          <button onClick={compararConPrevio} style={{ marginLeft: "10px" }}>
            Comparar con estudio previo
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
        {imagenes.map((img) => {
          const thumb = img.thumbnail
            ? `http://192.168.5.21:8000/${img.thumbnail}`
            : null;

          const urlDicom = img.ruta_archivo
            ? `http://192.168.5.21:8000${img.ruta_archivo}`
            : null;

          return (
            <div
              key={img.id}
              style={{
                border: "1px solid #ccc",
                padding: "10px",
                borderRadius: "6px",
                width: "150px",
                textAlign: "center",
              }}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt="thumbnail"
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onDoubleClick={() => {
                    if (img.tipo === "dcm" && urlDicom) {
                      setUrlSeleccionada(urlDicom);
                    }
                  }}
                />
              ) : (
                <p style={{ color: "gray" }}>Sin miniatura</p>
              )}

              {img.tipo === "dcm" && urlDicom && (
                <button
                  onClick={() => setUrlSeleccionada(urlDicom)}
                  style={{ marginTop: "10px" }}
                >
                  Ver esta imagen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
