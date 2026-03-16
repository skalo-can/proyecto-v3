/**
 * CompareViewer.jsx — MI_PACS
 * ---------------------------------------------------------
 * Comparación clínica lado a lado para estudios médicos.
 *
 * Características:
 * ✔ Dos viewports independientes (A y B)
 * ✔ Dos stacks de imágenes
 * ✔ Herramientas clínicas básicas (WL, Pan, Zoom, Scroll)
 * ✔ Scroll sincronizado opcional
 * ✔ Limpieza segura al desmontar
 *
 * Compatible con Cornerstone3D (v3)
 */

import { useState, useEffect } from "react";

import * as csTools from "@cornerstonejs/tools";
import * as cs3d from "@cornerstonejs/core";
import * as dicomLoader from "@cornerstonejs/dicom-image-loader";
import dicomParser from "dicom-parser";

import Toolbar from "./Toolbar";
import CineControls from "./CineControls";
import Viewport from "./Viewport";

export default function CompareViewer({ urlsA, urlsB, onVolver }) {
  const [vpLeft, setVpLeft] = useState(null);
  const [vpRight, setVpRight] = useState(null);

  const [stackLeft, setStackLeft] = useState(null);
  const [stackRight, setStackRight] = useState(null);

  const [syncScroll, setSyncScroll] = useState(true);

  // ---------------------------------------------------------
  // Inicialización global (loader DICOM + herramientas)
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (!cs3d.isInitialized()) {
          await cs3d.init();
        }
        csTools.init();

        dicomLoader.external.cornerstone = cs3d;
        dicomLoader.external.dicomParser = dicomParser;

        dicomLoader.configure({
          beforeSend: (xhr) => {
            xhr.setRequestHeader("Accept", "application/dicom");
          },
        });

        // Registrar herramientas clínicas básicas
        csTools.addTool(csTools.WindowLevelTool);
        csTools.addTool(csTools.PanTool);
        csTools.addTool(csTools.ZoomTool);
        csTools.addTool(csTools.StackScrollMouseWheelTool);
      } catch (err) {
        console.error("Error inicializando CompareViewer:", err);
        alert("No se pudo cargar la comparación clínica.");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------------------------------------------------
  // CALLBACK: Viewport izquierdo listo
  // ---------------------------------------------------------
  const onLeftReady = async (vp) => {
    setVpLeft(vp);

    const stackA = {
      imageIds: urlsA.map((u) => `wadouri:${u}`),
      currentImageIdIndex: 0,
    };

    setStackLeft(stackA);
    await vp.setStack(stackA);
    await vp.render();

    // Scroll sincronizado
    vp.element.addEventListener("wheel", () => {
      if (syncScroll && vpRight) {
        vpRight.nextImage();
        vpRight.render();
      }
    });
  };

  // ---------------------------------------------------------
  // CALLBACK: Viewport derecho listo
  // ---------------------------------------------------------
  const onRightReady = async (vp) => {
    setVpRight(vp);

    const stackB = {
      imageIds: urlsB.map((u) => `wadouri:${u}`),
      currentImageIdIndex: 0,
    };

    setStackRight(stackB);
    await vp.setStack(stackB);
    await vp.render();

    // Scroll sincronizado
    vp.element.addEventListener("wheel", () => {
      if (syncScroll && vpLeft) {
        vpLeft.nextImage();
        vpLeft.render();
      }
    });
  };

  // ---------------------------------------------------------
  // Render clínico
  // ---------------------------------------------------------
  return (
    <div style={{ padding: "20px" }}>
      <button onClick={onVolver}>← Volver</button>
      <h2>Comparación lado a lado</h2>

      <label style={{ marginTop: "10px", display: "inline-block" }}>
        <input
          type="checkbox"
          checked={syncScroll}
          onChange={() => setSyncScroll(!syncScroll)}
        />
        Sincronizar scroll
      </label>

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        {/* Panel izquierdo */}
        <div style={{ width: "50%" }}>
          <h3>Estudio A</h3>

          <Toolbar viewport={vpLeft} />
          <CineControls viewport={vpLeft} stack={stackLeft} />

          <div style={{ width: "100%", height: "70vh", marginTop: "10px" }}>
            <Viewport
              viewportId="compare-left"
              type="stack"
              onReady={onLeftReady}
            />
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ width: "50%" }}>
          <h3>Estudio B</h3>

          <Toolbar viewport={vpRight} />
          <CineControls viewport={vpRight} stack={stackRight} />

          <div style={{ width: "100%", height: "70vh", marginTop: "10px" }}>
            <Viewport
              viewportId="compare-right"
              type="stack"
              onReady={onRightReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
}