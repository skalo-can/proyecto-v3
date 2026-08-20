/**
 * Toolbar.jsx — MI_PACS (Versión Premium SKALO)
 * ---------------------------------------------------------
 * Herramientas Básicas: Zoom, Pan, W/L, Flip, Rotar
 * Herramientas Premium: ROI, Negativo, Historial (Protegidas)
 */

import React from "react";
import {
  PanTool,
  ZoomTool,
  WindowLevelTool,
  EllipticalROITool, // 🎯 Herramienta ROI Inyectada
} from "@cornerstonejs/tools";
import { useAuth } from "../../AuthContext"; // Ajusta la ruta si es necesario

export default function Toolbar({ viewport, toolGroup, onToggleHistory }) {
  const { user } = useAuth();

  // 🛡️ VALIDACIÓN DE SEGURIDAD SKALO / RADIÓLOGO
  const userRol = String(user?.rol || "").toLowerCase().trim();
  const currentIdentificador = String(user?.username || user?.nombre || user?.email || "").toUpperCase();
  const isSkalo = currentIdentificador.includes("SKALO") || userRol === "superadmin";
  const isRadiologo = userRol === "radiologo" || userRol.startsWith("medico") || isSkalo;

  if (!viewport || !toolGroup) {
    console.warn("Toolbar MI_PACS: viewport o toolGroup no disponibles.");
    return null;
  }

  const activarHerramienta = (toolName) => {
    try {
      toolGroup.setToolActive(toolName, { bindings: [{ mouseButton: 1 }] }); // Mouse Izquierdo
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
    } catch (err) { console.error("MI_PACS → Error en Flip Horizontal:", err); }
  };

  const flipV = async () => {
    try {
      const camera = viewport.getCamera();
      camera.flipVertical = !camera.flipVertical;
      viewport.setCamera(camera);
      await viewport.render();
    } catch (err) { console.error("MI_PACS → Error en Flip Vertical:", err); }
  };

  const rotar90 = async () => {
    try {
      const camera = viewport.getCamera();
      camera.rotation = (camera.rotation || 0) + 90;
      viewport.setCamera(camera);
      await viewport.render();
    } catch (err) { console.error("MI_PACS → Error al rotar:", err); }
  };

  // 🌗 NUEVO: INVERTIR COLORES (NEGATIVO)
  const toggleInvert = async () => {
    try {
      const properties = viewport.getProperties();
      viewport.setProperties({ invert: !properties.invert });
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error en Invertir Colores (Negativo):", err);
    }
  };

  // --- ESTILOS DE BOTONES ---
  const btnStyle = { padding: "6px 12px", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" };
  const premiumBtnStyle = { ...btnStyle, backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid #10b981" };
  const efilmBtnStyle = { ...btnStyle, backgroundColor: "#fbbf24", color: "#172554", border: "none" };

  return (
    <div style={{ padding: "10px", display: "flex", gap: "15px", flexWrap: "wrap", backgroundColor: "#0f172a", borderBottom: "1px solid #1e293b" }}>
      
      {/* 🛠️ HERRAMIENTAS BÁSICAS */}
      <div style={{ display: "flex", gap: "6px", borderRight: "1px solid #334155", paddingRight: "15px" }}>
        <button style={btnStyle} onClick={() => activarHerramienta(WindowLevelTool.toolName)}>🌗 Contraste</button>
        <button style={btnStyle} onClick={() => activarHerramienta(ZoomTool.toolName)}>🔍 Zoom</button>
        <button style={btnStyle} onClick={() => activarHerramienta(PanTool.toolName)}>✋ Mover</button>
        <button style={btnStyle} onClick={rotar90}>🔄 Rotar</button>
        <button style={btnStyle} onClick={flipH}>↔️ Flip H</button>
        <button style={btnStyle} onClick={flipV}>↕️ Flip V</button>
      </div>

      {/* 💎 HERRAMIENTAS PREMIUM (Controladas por SKALO) */}
      {isRadiologo && (
        <div style={{ display: "flex", gap: "6px" }}>
          <button style={premiumBtnStyle} onClick={() => activarHerramienta(EllipticalROITool.toolName)} title="Medir Densidad y Área">
            🎯 ROI
          </button>
          
          <button style={premiumBtnStyle} onClick={toggleInvert} title="Invertir Blanco/Negro">
            🌗 Negativo
          </button>

          <button style={efilmBtnStyle} onClick={onToggleHistory} title="Comparar con estudios previos">
            📂 Historial
          </button>
        </div>
      )}
    </div>
  );
}