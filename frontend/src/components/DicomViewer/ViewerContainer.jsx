/**
 * ViewerContainer.jsx — MI_PACS
 * ---------------------------------------------------------
 * Visor simple para mostrar UNA imagen DICOM.
 * Basado en el componente clínico Viewport.jsx (Cornerstone3D v3).
 *
 * ✔ Recibe una URL DICOM real desde ImagenesEstudio.jsx
 * ✔ Compatible con doble‑click desde miniaturas
 * ✔ Compatible con botón “Ver esta imagen”
 * ✔ Sin inicializaciones duplicadas de Cornerstone3D
 */

import React from "react";
import Viewport from "./Viewport";

export default function ViewerContainer({ url }) {
  if (!url) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          backgroundColor: "black",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>No se recibió una URL DICOM válida.</p>
      </div>
    );
  }

  const imageId = `wadouri:${url}`;

  console.log("MI_PACS → ViewerContainer cargando imagen:", imageId);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Viewport
        viewportId="mipacs-viewer-simple"
        type="stack"
        imageIds={[imageId]}
        onReady={() => {
          console.log("MI_PACS → ViewerContainer listo.");
        }}
      />
    </div>
  );
}