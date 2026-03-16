/**
 * IAOverlay.jsx — MI_PACS
 * ---------------------------------------------------------
 * Capa visual para mostrar hallazgos IA sobre el visor DICOM.
 *
 * Características:
 * ✔ Dibuja bounding boxes sobre el corte actual
 * ✔ Solo visible cuando el médico lo solicita
 * ✔ Overlay transparente, no interfiere con la imagen
 * ✔ No altera el diagnóstico: es únicamente una guía visual
 *
 * Nota:
 * Este overlay utiliza coordenadas relativas al tamaño del viewport.
 * En una integración avanzada se emplearán coordenadas físicas DICOM.
 */

import React from "react";

export default function IAOverlay({ iaResultado, sliceIndex, viewportSize }) {
  // Validación clínica
  if (!iaResultado?.hallazgos || !viewportSize) {
    console.warn("IAOverlay MI_PACS: datos insuficientes para renderizar overlay.");
    return null;
  }

  const { width, height } = viewportSize;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    >
      {iaResultado.hallazgos
        .filter((h) => h.slice_index === sliceIndex)
        .map((h, idx) => {
          if (!h.bounding_box || h.bounding_box.length !== 4) {
            console.warn("MI_PACS → bounding_box inválido:", h);
            return null;
          }

          let [x1, y1, x2, y2] = h.bounding_box;

          // Protección ante valores fuera de rango
          x1 = Math.max(0, Math.min(x1, width));
          x2 = Math.max(0, Math.min(x2, width));
          y1 = Math.max(0, Math.min(y1, height));
          y2 = Math.max(0, Math.min(y2, height));

          const boxWidth = Math.max(1, x2 - x1);
          const boxHeight = Math.max(1, y2 - y1);

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                border: "2px solid red",
                left: x1,
                top: y1,
                width: boxWidth,
                height: boxHeight,
                pointerEvents: "none",
              }}
            >
              {/* Etiqueta clínica */}
              <div
                style={{
                  position: "absolute",
                  top: "-20px",
                  left: 0,
                  background: "red",
                  color: "white",
                  padding: "2px 4px",
                  fontSize: "12px",
                  borderRadius: "2px",
                }}
              >
                {h.tipo} ({(h.probabilidad * 100).toFixed(1)}%)
              </div>
            </div>
          );
        })}
    </div>
  );
}