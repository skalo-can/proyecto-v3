/**
 * Toolbar.jsx — MI_PACS
 * ---------------------------------------------------------
 * Herramientas básicas:
 * - Zoom
 * - Pan
 * - Window/Level
 * - Flip H/V
 * - Rotar 90°
 */

import React from "react";
import {
  PanTool,
  ZoomTool,
  WindowLevelTool,
} from "@cornerstonejs/tools";

export default function Toolbar({ viewport, toolGroup }) {
  if (!viewport || !toolGroup) {
    console.warn("Toolbar MI_PACS: viewport o toolGroup no disponibles.");
    return null;
  }

  const activarHerramienta = (toolName) => {
    try {
      toolGroup.setToolActive(toolName, {
        bindings: [],
      });
      console.log(`MI_PACS → Herramienta activada: ${toolName}`);
    } catch (err) {
      console.error("MI_PACS → Error al activar herramienta:", err);
    }
  };

  const flipH = async () => {
    try {
      const camera = viewport.getCamera();
      camera.flipHorizontal = !camera.flipHorizontal;
      viewport.setCamera(camera);
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error en Flip Horizontal:", err);
    }
  };

  const flipV = async () => {
    try {
      const camera = viewport.getCamera();
      camera.flipVertical = !camera.flipVertical;
      viewport.setCamera(camera);
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error en Flip Vertical:", err);
    }
  };

  const rotar90 = async () => {
    try {
      const camera = viewport.getCamera();
      camera.rotation = (camera.rotation || 0) + 90;
      viewport.setCamera(camera);
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error al rotar:", err);
    }
  };

  return (
    <div
      style={{
        marginTop: "10px",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      <button onClick={() => activarHerramienta(ZoomTool.toolName)}>
        Zoom
      </button>
      <button onClick={() => activarHerramienta(PanTool.toolName)}>
        Pan
      </button>
      <button
        onClick={() => activarHerramienta(WindowLevelTool.toolName)}
      >
        Contraste
      </button>

      <button onClick={flipH}>Flip H</button>
      <button onClick={flipV}>Flip V</button>

      <button onClick={rotar90}>Rotar 90°</button>
    </div>
  );
}