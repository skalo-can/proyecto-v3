/**
 * AdvancedToolbar.jsx — MI_PACS
 * ---------------------------------------------------------
 * Herramientas avanzadas:
 * - Distancia
 * - Ángulo
 * - ROI rectangular
 * - ROI elíptica
 * - Borrar anotaciones
 * - Window presets (VOI)
 */

import React from "react";
import {
  LengthTool,
  AngleTool,
  RectangleROITool,
  EllipticalROITool,
  annotation,
} from "@cornerstonejs/tools";

export default function AdvancedToolbar({ viewport, toolGroup }) {
  if (!viewport || !toolGroup) {
    console.warn("AdvancedToolbar MI_PACS: viewport o toolGroup no disponibles.");
    return null;
  }

  const activarHerramienta = (toolName) => {
    try {
      toolGroup.setToolActive(toolName, {
        bindings: [],
      });
      console.log(`MI_PACS → Herramienta avanzada activada: ${toolName}`);
    } catch (err) {
      console.error("MI_PACS → Error al activar herramienta avanzada:", err);
    }
  };

  const aplicarPreset = async (preset) => {
    const presets = {
      hueso: { ww: 2000, wc: 300 },
      pulmon: { ww: 1500, wc: -600 },
      cerebro: { ww: 80, wc: 40 },
      abdomen: { ww: 350, wc: 50 },
      tejido: { ww: 400, wc: 40 },
    };

    if (!presets[preset]) {
      console.warn("MI_PACS → Preset VOI inválido:", preset);
      return;
    }

    const { ww, wc } = presets[preset];

    try {
      viewport.setProperties({
        voiRange: {
          lower: wc - ww / 2,
          upper: wc + ww / 2,
        },
      });

      await viewport.render();
      console.log(`MI_PACS → Preset clínico aplicado: ${preset}`);
    } catch (err) {
      console.error("MI_PACS → Error aplicando preset clínico:", err);
    }
  };

  const borrarAnotaciones = () => {
    try {
      annotation.state.removeAllAnnotations();
      viewport.render();
      console.log("MI_PACS → Anotaciones borradas.");
    } catch (err) {
      console.error("MI_PACS → Error borrando anotaciones:", err);
    }
  };

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "6px",
      }}
    >
      <h3>Herramientas avanzadas</h3>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => activarHerramienta(LengthTool.toolName)}>
          Medir distancia
        </button>

        <button onClick={() => activarHerramienta(AngleTool.toolName)}>
          Medir ángulo
        </button>

        <button
          onClick={() =>
            activarHerramienta(RectangleROITool.toolName)
          }
        >
          ROI rectangular
        </button>

        <button
          onClick={() =>
            activarHerramienta(EllipticalROITool.toolName)
          }
        >
          ROI elíptica
        </button>

        <button onClick={borrarAnotaciones}>Borrar anotaciones</button>
      </div>

      <h4 style={{ marginTop: "12px" }}>Window presets</h4>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => aplicarPreset("hueso")}>Hueso</button>
        <button onClick={() => aplicarPreset("pulmon")}>Pulmón</button>
        <button onClick={() => aplicarPreset("cerebro")}>Cerebro</button>
        <button onClick={() => aplicarPreset("abdomen")}>Abdomen</button>
        <button onClick={() => aplicarPreset("tejido")}>Soft Tissue</button>
      </div>
    </div>
  );
}