/**
 * IASegmentationOverlay.jsx — MI_PACS
 * ---------------------------------------------------------
 * Overlay semitransparente para mostrar máscaras de segmentación IA.
 *
 * Características:
 * ✔ Máscara pixelada sobre el corte actual
 * ✔ Canvas independiente (no modifica la imagen DICOM)
 * ✔ Color configurable según tipo de lesión
 * ✔ Opacidad ajustable
 * ✔ Solo visible cuando el médico lo activa
 *
 * Filosofía MI_PACS:
 * La IA guía, el médico decide.
 */

import { useEffect, useRef } from "react";

export default function IASegmentationOverlay({
  segmentacion,
  sliceIndex,
  viewportSize,
  opacity = 0.35,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // ---------------------------------------------------------
    // Validación clínica
    // ---------------------------------------------------------
    if (!segmentacion) {
      console.warn("IASegmentationOverlay MI_PACS: segmentación no disponible.");
      return;
    }

    if (segmentacion.slice_index !== sliceIndex) {
      return; // No corresponde a este corte
    }

    if (!viewportSize?.width || !viewportSize?.height) {
      console.warn("IASegmentationOverlay MI_PACS: viewportSize inválido.");
      return;
    }

    const { mask, color } = segmentacion;

    if (!mask || !Array.isArray(mask) || !mask.length || !mask[0].length) {
      console.warn("IASegmentationOverlay MI_PACS: máscara IA inválida.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("IASegmentationOverlay MI_PACS: no se pudo obtener contexto 2D.");
      return;
    }

    const width = viewportSize.width;
    const height = viewportSize.height;

    // ---------------------------------------------------------
    // Ajustar tamaño del canvas al viewport
    // ---------------------------------------------------------
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const rows = mask.length;
    const cols = mask[0].length;

    const cellWidth = width / cols;
    const cellHeight = height / rows;

    // Color clínico de la máscara
    const [r, g, b] = color || [255, 0, 0];
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

    // ---------------------------------------------------------
    // Pintar máscara pixelada
    // ---------------------------------------------------------
    try {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (mask[y][x] === 1) {
            ctx.fillRect(
              x * cellWidth,
              y * cellHeight,
              cellWidth,
              cellHeight
            );
          }
        }
      }
    } catch (err) {
      console.error("MI_PACS → Error pintando segmentación IA:", err);
    }
  }, [segmentacion, sliceIndex, viewportSize, opacity]);

  // ---------------------------------------------------------
  // Render clínico
  // ---------------------------------------------------------
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
}