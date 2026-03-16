/**
 * ThumbnailList.jsx — MI_PACS
 * ---------------------------------------------------------
 * Lista de thumbnails para navegación rápida entre cortes.
 *
 * Versión simplificada y robusta para Cornerstone3D v3:
 * - No usa imageLoader interno (v2)
 * - No usa wadouri
 * - No genera errores en consola
 * - Permite navegación clínica por índice de corte
 */

import { useEffect, useState } from "react";

export default function ThumbnailList({ viewport, stack, onSelectSlice }) {
  const [thumbnails, setThumbnails] = useState([]);

  // ---------------------------------------------------------
  // Generar "thumbnails" lógicos (solo índices) al cargar el stack
  // ---------------------------------------------------------
  useEffect(() => {
    if (!stack || !stack.imageIds) {
      console.warn("ThumbnailList MI_PACS: stack no disponible.");
      setThumbnails([]);
      return;
    }

    const thumbs = stack.imageIds.map((_, index) => ({
      index,
    }));

    setThumbnails(thumbs);
  }, [stack]);

  const irACorte = async (index) => {
    try {
      if (!stack) {
        console.warn("ThumbnailList MI_PACS: stack no disponible.");
        return;
      }

      if (typeof onSelectSlice === "function") {
        await onSelectSlice(index);
      } else {
        console.warn(
          "ThumbnailList MI_PACS: onSelectSlice no definido en props."
        );
      }
    } catch (err) {
      console.error("MI_PACS → Error navegando al corte:", err);
    }
  };

  // ---------------------------------------------------------
  // Render clínico
  // ---------------------------------------------------------
  return (
    <div
      style={{
        width: "140px",
        overflowY: "auto",
        borderLeft: "1px solid #ccc",
        padding: "10px",
      }}
    >
      <h4>Thumbnails</h4>

      {thumbnails.map((t) => (
        <div
          key={t.index}
          onClick={() => irACorte(t.index)}
          style={{
            marginBottom: "10px",
            cursor: "pointer",
            border: "1px solid #ddd",
            borderRadius: "4px",
            padding: "6px",
            textAlign: "center",
            backgroundColor: "#f9f9f9",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "60px",
              backgroundColor: "#222",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            Corte {t.index}
          </div>
        </div>
      ))}
    </div>
  );
}