/**
 * MPRViewer.jsx — MI_PACS
 * ---------------------------------------------------------
 * Reconstrucción Multiplanar (MPR) basada en Cornerstone3D.
 *
 * Funcionalidades:
 * - Tres planos: Axial, Sagital, Coronal
 * - Volumen compartido y crosshair sincronizado
 * - Navegación clínica en 3D
 * - Integración con IA:
 *   * Recibe hallazgos IA
 *   * Permite mover el crosshair a cortes sugeridos
 *   * IA actúa como guía, no como diagnóstico
 *
 * Filosofía MI_PACS:
 * La IA NO toma decisiones:
 * - Solo sugiere zonas/cortes de interés
 * - El médico mantiene el control total
 */

import { useEffect, useRef, useState } from "react";

import * as cs3d from "@cornerstonejs/core";
import * as csTools from "@cornerstonejs/tools";

import dicomParser from "dicom-parser";
import * as dicomLoader from "@cornerstonejs/dicom-image-loader";

export default function MPRViewer({ urls, onVolver, iaResultado = null }) {
  const axialRef = useRef(null);
  const sagittalRef = useRef(null);
  const coronalRef = useRef(null);

  const [volume, setVolume] = useState(null);

  const [axialVp, setAxialVp] = useState(null);
  const [sagittalVp, setSagittalVp] = useState(null);
  const [coronalVp, setCoronalVp] = useState(null);

  // Punto de cruce compartido (x, y, z en espacio del volumen)
  const [crosshair, setCrosshair] = useState({ x: 0, y: 0, z: 0 });

  // ---------------------------------------------------------
  // INICIALIZACIÓN DEL MPR
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log("Inicializando MPR MI_PACS...");

        // Evitar doble inicialización
        if (!cs3d.isInitialized()) {
          await cs3d.init();
        }
        csTools.init();

        // Configurar loader DICOM
        dicomLoader.external.cornerstone = cs3d;
        dicomLoader.external.dicomParser = dicomParser;

        dicomLoader.configure({
          beforeSend: (xhr) => {
            xhr.setRequestHeader("Accept", "application/dicom");
          },
        });

        // Crear volumen
        const imageIds = urls.map((u) => `wadouri:${u}`);
        const volumeId = "mpr-volume";

        // Limpiar volumen previo si existe
        try {
          cs3d.volumeLoader.removeVolumeFromCache(volumeId);
        } catch {}

        const vol = await cs3d.volumeLoader.createAndCacheVolume(volumeId, {
          imageIds,
        });

        await vol.load();
        if (!mounted) return;

        setVolume(vol);

        // Crear viewports
        const vpAxial = await cs3d.createViewport({
          element: axialRef.current,
          viewportId: "mpr-axial",
          type: "volume",
        });

        const vpSagittal = await cs3d.createViewport({
          element: sagittalRef.current,
          viewportId: "mpr-sagittal",
          type: "volume",
        });

        const vpCoronal = await cs3d.createViewport({
          element: coronalRef.current,
          viewportId: "mpr-coronal",
          type: "volume",
        });

        if (!mounted) return;

        setAxialVp(vpAxial);
        setSagittalVp(vpSagittal);
        setCoronalVp(vpCoronal);

        // Asignar volumen
        vpAxial.setVolumes([{ volumeId }]);
        vpSagittal.setVolumes([{ volumeId }]);
        vpCoronal.setVolumes([{ volumeId }]);

        // Orientaciones clínicas
        vpAxial.setOrientation("axial");
        vpSagittal.setOrientation("sagittal");
        vpCoronal.setOrientation("coronal");

        // Crosshair inicial
        const { dimensions } = vol;
        const initialCrosshair = {
          x: Math.floor(dimensions[0] / 2),
          y: Math.floor(dimensions[1] / 2),
          z: Math.floor(dimensions[2] / 2),
        };

        setCrosshair(initialCrosshair);

        actualizarViewportsConCrosshair(
          vpAxial,
          vpSagittal,
          vpCoronal,
          initialCrosshair
        );

        await vpAxial.render();
        await vpSagittal.render();
        await vpCoronal.render();

        console.log("MPR inicializado con crosshair:", initialCrosshair);
      } catch (err) {
        console.error("Error inicializando MPR:", err);
        alert("No se pudo inicializar MPR.");
      }
    }

    init();

    return () => {
      mounted = false;

      try {
        if (axialRef.current) cs3d.disableElement(axialRef.current);
        if (sagittalRef.current) cs3d.disableElement(sagittalRef.current);
        if (coronalRef.current) cs3d.disableElement(coronalRef.current);
      } catch {}

      try {
        cs3d.volumeLoader.removeVolumeFromCache("mpr-volume");
      } catch {}
    };
  }, [urls]);

  // ---------------------------------------------------------
  // ACTUALIZAR VIEWPORTS SEGÚN CROSSHAIR
  // ---------------------------------------------------------
  function actualizarViewportsConCrosshair(vpAxial, vpSagittal, vpCoronal, ch) {
    if (!vpAxial || !vpSagittal || !vpCoronal || !volume) return;

    vpAxial.setCamera({
      focalPoint: [ch.x, ch.y, ch.z],
      position: [ch.x, ch.y, ch.z + 500],
    });

    vpSagittal.setCamera({
      focalPoint: [ch.x, ch.y, ch.z],
      position: [ch.x + 500, ch.y, ch.z],
    });

    vpCoronal.setCamera({
      focalPoint: [ch.x, ch.y, ch.z],
      position: [ch.x, ch.y + 500, ch.z],
    });

    vpAxial.render();
    vpSagittal.render();
    vpCoronal.render();
  }

  // ---------------------------------------------------------
  // CONTROLES MANUALES DEL CROSSHAIR
  // ---------------------------------------------------------
  const moverAxial = (deltaZ) => {
    if (!volume) return;

    setCrosshair((prev) => {
      const { dimensions } = volume;
      const nuevo = {
        ...prev,
        z: Math.min(Math.max(prev.z + deltaZ, 0), dimensions[2] - 1),
      };

      actualizarViewportsConCrosshair(axialVp, sagittalVp, coronalVp, nuevo);
      return nuevo;
    });
  };

  const moverSagital = (deltaX) => {
    if (!volume) return;

    setCrosshair((prev) => {
      const { dimensions } = volume;
      const nuevo = {
        ...prev,
        x: Math.min(Math.max(prev.x + deltaX, 0), dimensions[0] - 1),
      };

      actualizarViewportsConCrosshair(axialVp, sagittalVp, coronalVp, nuevo);
      return nuevo;
    });
  };

  const moverCoronal = (deltaY) => {
    if (!volume) return;

    setCrosshair((prev) => {
      const { dimensions } = volume;
      const nuevo = {
        ...prev,
        y: Math.min(Math.max(prev.y + deltaY, 0), dimensions[1] - 1),
      };

      actualizarViewportsConCrosshair(axialVp, sagittalVp, coronalVp, nuevo);
      return nuevo;
    });
  };

  // ---------------------------------------------------------
  // MOVER CROSSHAIR SEGÚN HALLAZGO IA
  // ---------------------------------------------------------
  const irAHallazgoIA = (hallazgo) => {
    if (!volume) return;
    if (!hallazgo || hallazgo.slice_index == null) return;

    const { dimensions } = volume;

    const nuevo = {
      ...crosshair,
      z: Math.min(
        Math.max(hallazgo.slice_index ?? crosshair.z, 0),
        dimensions[2] - 1
      ),
    };

    setCrosshair(nuevo);
    actualizarViewportsConCrosshair(axialVp, sagittalVp, coronalVp, nuevo);

    console.log("Crosshair movido por IA a:", nuevo);
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div style={{ padding: "20px", display: "flex", gap: "20px" }}>
      {/* Panel izquierdo: MPR */}
      <div style={{ flex: 3 }}>
        <button onClick={onVolver}>← Volver</button>
        <h2>MPR – Reconstrucción Multiplanar</h2>

        <p>
          Crosshair actual: x={crosshair.x}, y={crosshair.y}, z={crosshair.z}
        </p>

        {/* Controles simples */}
        <div style={{ marginBottom: "10px" }}>
          <strong>Axial (Z): </strong>
          <button onClick={() => moverAxial(-1)}>-</button>
          <button onClick={() => moverAxial(1)} style={{ marginLeft: "5px" }}>
            +
          </button>

          <strong style={{ marginLeft: "20px" }}>Sagital (X): </strong>
          <button onClick={() => moverSagital(-1)}>-</button>
          <button onClick={() => moverSagital(1)} style={{ marginLeft: "5px" }}>
            +
          </button>

          <strong style={{ marginLeft: "20px" }}>Coronal (Y): </strong>
          <button onClick={() => moverCoronal(-1)}>-</button>
          <button onClick={() => moverCoronal(1)} style={{ marginLeft: "5px" }}>
            +
          </button>
        </div>

        {/* Grid MPR */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: "10px",
            height: "80vh",
            marginTop: "20px",
          }}
        >
          <div>
            <h3>Axial</h3>
            <div
              ref={axialRef}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
            />
          </div>

          <div>
            <h3>Sagital</h3>
            <div
              ref={sagittalRef}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
            />
          </div>

          <div>
            <h3>Coronal</h3>
            <div
              ref={coronalRef}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "black",
              }}
            />
          </div>
        </div>
      </div>

      {/* Panel derecho: IA */}
      {iaResultado && (
        <div
          style={{
            flex: 1,
            border: "1px solid #ccc",
            padding: "10px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <h3>Ayuda IA en MPR</h3>
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            Modelo: {iaResultado.modelo || "desconocido"}
          </p>

          {iaResultado.hallazgos?.length > 0 ? (
            iaResultado.hallazgos.map((h, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  marginBottom: "8px",
                  borderRadius: "4px",
                }}
              >
                <p>
                  <strong>Tipo:</strong> {h.tipo}
                </p>
                <p>
                  <strong>Probabilidad:</strong>{" "}
                  {(h.probabilidad * 100).toFixed(1)}%
                </p>
                <p>
                  <strong>Corte axial sugerido (Z):</strong> {h.slice_index}
                </p>

                <button onClick={() => irAHallazgoIA(h)}>
                  Ir a este hallazgo en MPR
                </button>
              </div>
            ))
          ) : (
            <p>No se encontraron hallazgos IA para este estudio.</p>
          )}

          <p style={{ fontSize: "0.8rem", marginTop: "10px", color: "#777" }}>
            La IA es solo una ayuda. El diagnóstico final siempre es
            responsabilidad del médico.
          </p>
        </div>
      )}
    </div>
  );
}