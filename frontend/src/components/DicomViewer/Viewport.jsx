/**
 * Viewport.jsx — MI_PACS (Cornerstone3D v3)
 * ---------------------------------------------------------
 * ✔ Inicializa RenderingEngine
 * ✔ Crea viewport
 * ✔ Expone viewportId y renderingEngineId correctamente
 * ✔ Llama onReady(viewport)
 */

import { useEffect, useRef } from "react";
import { RenderingEngine, Enums } from "@cornerstonejs/core";

export default function Viewport({ type = "stack", viewportId, onReady }) {
  const elementRef = useRef(null);
  const engineRef = useRef(null);
  const viewportRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log(`MI_PACS → Inicializando viewport clínico (${viewportId})...`);

        const element = elementRef.current;
        if (!element) return;

        // Crear motor si no existe
        if (!engineRef.current) {
          console.log("MI_PACS → Creando RenderingEngine clínico.");
          engineRef.current = new RenderingEngine("mipacs-engine");
        } else {
          console.log("MI_PACS → Reutilizando RenderingEngine clínico.");
        }

        const engine = engineRef.current;

        // Habilitar viewport con engineId explícito
        engine.enableElement({
          viewportId,
          renderingEngineId: "mipacs-engine",   // ← CLAVE
          type: type === "stack" ? Enums.ViewportType.STACK : Enums.ViewportType.ORTHOGRAPHIC,
          element,
        });

        viewportRef.current = engine.getViewport(viewportId);

        // Asignar IDs manualmente (Cornerstone no los expone solos)
        viewportRef.current.viewportId = viewportId;
        viewportRef.current.renderingEngineId = "mipacs-engine";

        if (mounted && onReady) {
          onReady(viewportRef.current);
        }

        console.log("MI_PACS → Viewport clínico listo.");
      } catch (err) {
        console.error("MI_PACS → Error inicializando viewport clínico:", err);
      }
    }

    init();

    return () => {
      console.log(`MI_PACS → Viewport desmontado (${viewportId}).`);
    };
  }, [viewportId, type]);

  return (
    <div
      ref={elementRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        position: "relative",
      }}
    />
  );
}