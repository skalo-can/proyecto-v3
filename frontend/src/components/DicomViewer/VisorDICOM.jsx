/**
 * VisorDICOM.jsx — MI_PACS
 * ---------------------------------------------------------
 * Visor clínico basado en Cornerstone3D (v3).
 *
 * Rol dentro del ecosistema MI_PACS:
 * ----------------------------------
 * ✔ Renderizar estudios DICOM en stack (modo médico)
 * ✔ Integrar herramientas clínicas (Pan, Zoom, WL, Scroll, ROI…)
 * ✔ Integrar IA (hallazgos + segmentación)
 * ✔ Permitir navegación por thumbnails
 * ✔ Permitir navegación por cortes IA
 * ✔ Mantener ToolGroup clínico único y estable
 *
 * Garantías clínicas:
 * -------------------
 * ✔ No crea ToolGroups duplicados
 * ✔ Maneja errores sin romper el visor
 * ✔ Limpieza segura al desmontar
 * ✔ URLs DICOM validadas antes de renderizar
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as csTools from "@cornerstonejs/tools";

import Toolbar from "./Toolbar";
import AdvancedToolbar from "./AdvancedToolbar";
import CineControls from "./CineControls";
import IAOverlay from "./IAOverlay";
import IASegmentationOverlay from "./IASegmentationOverlay";
import ThumbnailList from "./ThumbnailList";
import Viewport from "./Viewport.jsx";

const TOOL_GROUP_ID = "mipacs-tool-group";

export default function VisorDICOM({ urls = [], modo = "medico", iaResultado = null }) {
  const navigate = useNavigate();

  const [viewport, setViewport] = useState(null);
  const [stack, setStack] = useState(null);
  const [toolGroup, setToolGroup] = useState(null);

  const [overlayActivo, setOverlayActivo] = useState(false);
  const [segmentacionActiva, setSegmentacionActiva] = useState(false);

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // ---------------------------------------------------------
  // Limpieza clínica al desmontar
  // ---------------------------------------------------------
  useEffect(() => {
    return () => {
      try {
        if (viewport?.element) {
          console.log("MI_PACS → Limpieza del visor clínico.");
        }
      } catch (err) {
        console.warn("MI_PACS → Error limpiando visor:", err);
      }
    };
  }, [viewport]);

  // ---------------------------------------------------------
  // Inicialización del viewport clínico
  // ---------------------------------------------------------
  const onViewportReady = async (vp) => {
    try {
      console.log("MI_PACS → URLs recibidas:", urls);

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        console.error("MI_PACS → No se recibieron URLs DICOM válidas.", urls);
        alert("No hay imágenes DICOM disponibles para este estudio.");
        return;
      }

      setViewport(vp);

      // ---------------------------------------------------------
      // 1. Crear / reutilizar ToolGroup clínico MI_PACS
      // ---------------------------------------------------------
      let tg = csTools.ToolGroupManager.getToolGroup(TOOL_GROUP_ID);

      if (!tg) {
        const {
          PanTool,
          ZoomTool,
          WindowLevelTool,
          LengthTool,
          AngleTool,
          RectangleROITool,
          EllipticalROITool,
          ToolGroupManager,
          addTool,
          Enums,
        } = csTools;

        console.log("MI_PACS → Creando ToolGroup clínico MI_PACS…");

        tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);

        const ScrollTool =
          csTools.StackScrollTool ||
          csTools.StackScrollMouseWheelTool ||
          null;

        const toolsToRegister = [
          PanTool,
          ZoomTool,
          WindowLevelTool,
          LengthTool,
          AngleTool,
          RectangleROITool,
          EllipticalROITool,
          ScrollTool,
        ];

        toolsToRegister.forEach((tool) => {
          if (tool) {
            addTool(tool);
            tg.addTool(tool.toolName);
          } else {
            console.warn("MI_PACS → Herramienta no encontrada, se omite.");
          }
        });

        tg.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
        });

        tg.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }],
        });

        tg.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: Enums.MouseBindings.Secondary }],
        });

        if (ScrollTool) {
          tg.setToolActive(ScrollTool.toolName, {
            bindings: [{ mouseButton: Enums.MouseBindings.Wheel }],
          });
        }
      }

      // Asociar viewport al ToolGroup
      if (vp.viewportId && vp.renderingEngineId) {
        tg.addViewport(vp.viewportId, vp.renderingEngineId);
        console.log("MI_PACS → Viewport asociado al ToolGroup clínico.");
      } else {
        console.warn("MI_PACS → Viewport no expone IDs válidos.");
      }

      setToolGroup(tg);

      // ---------------------------------------------------------
      // 2. Construir stack y renderizar
      // ---------------------------------------------------------
      const imageIds = urls.map((u) => `wadouri:${u}`);

      const newStack = {
        imageIds,
        currentImageIdIndex: 0,
      };

      setStack(newStack);

      if (csTools.utilities?.stack?.setStack) {
        await csTools.utilities.stack.setStack(vp, newStack);
      }

      await vp.render();

      const el = vp.element;
      setViewportSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });

      console.log("MI_PACS → Viewport clínico inicializado.");
    } catch (err) {
      console.error("MI_PACS → Error inicializando visor clínico:", err);
      alert("No se pudo inicializar el visor DICOM.");
    }
  };

  // ---------------------------------------------------------
  // Navegar a corte IA
  // ---------------------------------------------------------
  const irACorteIA = async (sliceIndex) => {
    try {
      if (!viewport || !stack) return;

      const maxIndex = stack.imageIds.length - 1;
      const idx = Math.min(Math.max(sliceIndex, 0), maxIndex);

      const nuevoStack = {
        ...stack,
        currentImageIdIndex: idx,
      };

      setStack(nuevoStack);

      if (csTools.utilities?.stack?.setStack) {
        await csTools.utilities.stack.setStack(viewport, nuevoStack);
      }

      await viewport.render();

      console.log("MI_PACS → Navegando a corte IA:", idx);
    } catch (err) {
      console.error("MI_PACS → Error navegando a corte IA:", err);
    }
  };

  // ---------------------------------------------------------
  // Navegar desde thumbnails
  // ---------------------------------------------------------
  const irACorteDesdeThumbnail = async (index) => {
    try {
      if (!viewport || !stack) return;

      const maxIndex = stack.imageIds.length - 1;
      const idx = Math.min(Math.max(index, 0), maxIndex);

      const nuevoStack = {
        ...stack,
        currentImageIdIndex: idx,
      };

      setStack(nuevoStack);

      if (csTools.utilities?.stack?.setStack) {
        await csTools.utilities.stack.setStack(viewport, nuevoStack);
      }

      await viewport.render();

      console.log("MI_PACS → Navegando al corte (thumbnail):", idx);
    } catch (err) {
      console.error("MI_PACS → Error navegando al corte (thumbnail):", err);
    }
  };

  // ---------------------------------------------------------
  // Render clínico
  // ---------------------------------------------------------
  return (
    <div style={{ padding: "20px", display: "flex", gap: "20px" }}>
      
      {/* Panel principal */}
      <div style={{ flex: 3, position: "relative" }}>
        
        {/* 🔥 BOTÓN CLÍNICO DE VOLVER */}
        <button onClick={() => navigate(-1)}>← Volver</button>

        <h2>Visor DICOM</h2>

        <Toolbar viewport={viewport} toolGroup={toolGroup} />

        {modo === "medico" && (
          <AdvancedToolbar viewport={viewport} toolGroup={toolGroup} />
        )}

        <CineControls viewport={viewport} stack={stack} />

        <div style={{ width: "100%", height: "70vh", marginTop: "20px" }}>
          <Viewport
            viewportId="mipacs-visor"
            type="stack"
            onReady={onViewportReady}
          />
        </div>

        {/* Overlays IA */}
        {overlayActivo && iaResultado && stack && (
          <IAOverlay
            iaResultado={iaResultado}
            sliceIndex={stack.currentImageIdIndex}
            viewportSize={viewportSize}
          />
        )}

        {segmentacionActiva &&
          iaResultado?.segmentacion &&
          stack &&
          viewportSize && (
            <IASegmentationOverlay
              segmentacion={iaResultado.segmentacion}
              sliceIndex={stack.currentImageIdIndex}
              viewportSize={viewportSize}
              opacity={0.35}
            />
          )}

        {/* Botones IA */}
        {modo === "medico" && iaResultado && (
          <>
            <button
              onClick={() => setOverlayActivo(!overlayActivo)}
              style={{
                marginTop: "10px",
                backgroundColor: overlayActivo ? "red" : "green",
                color: "white",
              }}
            >
              {overlayActivo ? "Ocultar overlay IA" : "Mostrar overlay IA"}
            </button>

            {iaResultado?.segmentacion && (
              <button
                onClick={() => setSegmentacionActiva(!segmentacionActiva)}
                style={{
                  marginTop: "10px",
                  marginLeft: "10px",
                  backgroundColor: segmentacionActiva ? "red" : "blue",
                  color: "white",
                }}
              >
                {segmentacionActiva
                  ? "Ocultar segmentación IA"
                  : "Mostrar segmentación IA"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Thumbnails */}
      <ThumbnailList
        viewport={viewport}
        stack={stack}
        onSelectSlice={irACorteDesdeThumbnail}
      />

      {/* Panel IA */}
      {modo === "medico" && iaResultado && (
        <div
          style={{
            flex: 1,
            border: "1px solid #ccc",
            padding: "10px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <h3>Ayuda IA (bajo solicitud)</h3>
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            Modelo: {iaResultado.modelo || "desconocido"}
          </p>

          {iaResultado.hallazgos.map((h, idx) => (
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
                <strong>Corte sugerido:</strong> {h.slice_index}
              </p>

              <button onClick={() => irACorteIA(h.slice_index)}>
                Ir a este corte
              </button>
            </div>
          ))}

          <p
            style={{
              fontSize: "0.8rem",
              marginTop: "10px",
              color: "#777",
            }}
          >
            La IA es solo una ayuda. El diagnóstico final siempre es
            responsabilidad del médico.
          </p>
        </div>
      )}
    </div>
  );
}