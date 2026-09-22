/**
 * VisorMPR3D.jsx — MI_PACS
 * ---------------------------------------------------------
 * Motor 3D Actualizado y Sincronizado con cornerstoneInit.js
 */

import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import dicomParser from "dicom-parser";

// 🚀 IMPORTACIONES
import * as csCore from "@cornerstonejs/core";
import * as csTools from "@cornerstonejs/tools";
import { cornerstoneStreamingImageVolumeLoader } from "@cornerstonejs/streaming-image-volume-loader";
// 🚀 FIX: Importar todo el módulo con '*' evita que Vite pierda funciones clave
import * as cornerstoneDICOMImageLoader from "@cornerstonejs/dicom-image-loader";

const API_BASE = window.location.origin;

export default function VisorMPR3D() {
  const { id: currentId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeToken = searchParams.get("token") || localStorage.getItem("token")?.replace(/['"]+/g, '');
  const isGuest = !!searchParams.get("token");

  const [cargando, setCargando] = useState(true);
  
  const axialRef = useRef(null);
  const sagittalRef = useRef(null);
  const coronalRef = useRef(null);

  useEffect(() => {
    const volumeId = "cornerstoneStreamingImageVolume:my_mpr_volume";
    const renderingEngineId = "my_mpr_rendering_engine";
    const toolGroupId = "mpr_tool_group";

    const inicializarMPR = async () => {
      try {
        if (typeof SharedArrayBuffer === 'undefined') {
          alert("⚠️ SharedArrayBuffer deshabilitado. Revisa vite.config.js");
          setCargando(false);
          return;
        }

        try { await csCore.init(); } catch (e) {}
        try { await csTools.init(); } catch (e) {}

        csCore.volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader);
        csCore.volumeLoader.registerVolumeLoader("cornerstoneStreamingImageVolume", cornerstoneStreamingImageVolumeLoader);

        // 🚀 EL FIX DEFINITIVO: Extraer el loader con seguridad
        const dicomLoader = cornerstoneDICOMImageLoader.default || cornerstoneDICOMImageLoader;

        // Asegurar dependencias sin reiniciar los Workers (cornerstoneInit.js ya lo hizo)
        if (!dicomLoader.external) dicomLoader.external = {};
        dicomLoader.external.cornerstone = csCore;
        dicomLoader.external.dicomParser = dicomParser;

        // 🚀 CONEXIÓN DIRECTA DEL ESQUEMA WADOURI (Esto evita el "no image loader")
        if (dicomLoader.wadouri && typeof dicomLoader.wadouri.loadImage === 'function') {
            csCore.imageLoader.registerImageLoader('wadouri', dicomLoader.wadouri.loadImage);
        } else {
            console.error("❌ dicomLoader.wadouri no existe. Revisa el import.", dicomLoader);
            alert("Fallo al inyectar wadouri. Revisa la consola F12.");
        }

        // Inyectar Token de Seguridad
        if (activeToken && !isGuest && typeof dicomLoader.configure === 'function') {
          dicomLoader.configure({
            beforeSend: (xhr) => xhr.setRequestHeader('Authorization', `Bearer ${activeToken}`)
          });
        }

        // Obtener rutas de las imágenes
        const urlFetch = isGuest 
          ? `${API_BASE}/api/secure-links/imagenes/${activeToken}` 
          : `${API_BASE}/api/estudios/${currentId}/imagenes`;
        
        const headersFetch = isGuest ? {} : { Authorization: `Bearer ${activeToken}` };
        const response = await fetch(urlFetch, { headers: headersFetch });
        const data = await response.json();

        if (!data || data.length === 0) throw new Error("No hay imágenes");

        const seriePrincipal = data.reduce((prev, current) => 
          (prev.imagenes.length > current.imagenes.length) ? prev : current
        );

        const imageIds = seriePrincipal.imagenes.map(img => 
          isGuest 
            ? `wadouri:${API_BASE}/api/secure-links/stream/${img.id}?token=${activeToken}` 
            : `wadouri:${API_BASE}/api/dicom/stream/${img.id}?token=${activeToken}`
        );

        // Limpieza de memoria
        let renderingEngine = csCore.getRenderingEngine(renderingEngineId);
        if (renderingEngine) { renderingEngine.destroy(); }
        let toolGroup = csTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) { csTools.ToolGroupManager.destroyToolGroup(toolGroupId); }
        if (csCore.cache.getVolume(volumeId)) { csCore.cache.removeVolumeLoadObject(volumeId); }

        // Crear Lienzos 3D
        renderingEngine = new csCore.RenderingEngine(renderingEngineId);
        toolGroup = csTools.ToolGroupManager.createToolGroup(toolGroupId);

        const viewportInputArray = [
          { viewportId: 'AXIAL_VIEWPORT', type: csCore.Enums.ViewportType.ORTHOGRAPHIC, element: axialRef.current, defaultOptions: { orientation: csCore.Enums.OrientationAxis.AXIAL, background: [0, 0, 0] } },
          { viewportId: 'SAGITTAL_VIEWPORT', type: csCore.Enums.ViewportType.ORTHOGRAPHIC, element: sagittalRef.current, defaultOptions: { orientation: csCore.Enums.OrientationAxis.SAGITTAL, background: [0, 0, 0] } },
          { viewportId: 'CORONAL_VIEWPORT', type: csCore.Enums.ViewportType.ORTHOGRAPHIC, element: coronalRef.current, defaultOptions: { orientation: csCore.Enums.OrientationAxis.CORONAL, background: [0, 0, 0] } },
        ];

        renderingEngine.setViewports(viewportInputArray);

        // Cargar Volumen y Proyectar
        const volume = await csCore.volumeLoader.createAndCacheVolume(volumeId, { imageIds });
        volume.load();

        await csCore.setVolumesForViewports(
          renderingEngine,
          [{ volumeId }],
          ['AXIAL_VIEWPORT', 'SAGITTAL_VIEWPORT', 'CORONAL_VIEWPORT']
        );

        renderingEngine.renderViewports(['AXIAL_VIEWPORT', 'SAGITTAL_VIEWPORT', 'CORONAL_VIEWPORT']);

        // Herramienta de cruce ortogonal
        try { csTools.addTool(csTools.CrosshairsTool); } catch (e) {}
        try {
          toolGroup.addTool(csTools.CrosshairsTool.toolName);
          toolGroup.setToolActive(csTools.CrosshairsTool.toolName, { bindings: [{ mouseButton: csTools.Enums.MouseBindings.Primary }] });
          toolGroup.addViewport('AXIAL_VIEWPORT', renderingEngineId);
          toolGroup.addViewport('SAGITTAL_VIEWPORT', renderingEngineId);
          toolGroup.addViewport('CORONAL_VIEWPORT', renderingEngineId);
        } catch (e) {}

        setCargando(false);

      } catch (error) {
        console.error("❌ Error inicializando MPR:", error);
        if (error && error.stack) console.error(error.stack); 
        setCargando(false);
      }
    };

    inicializarMPR();

    return () => {
      const engine = csCore.getRenderingEngine(renderingEngineId);
      if (engine) engine.destroy();
      const tg = csTools.ToolGroupManager.getToolGroup(toolGroupId);
      if (tg) csTools.ToolGroupManager.destroyToolGroup(toolGroupId);
      csCore.cache.purgeCache();
    };
  }, [currentId, activeToken, isGuest]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={{ margin: 0, color: '#fbbf24' }}>🧊 MI_PACS - Reconstrucción Multiplanar (MPR) 3D</h3>
        <button style={styles.btnCerrar} onClick={() => window.close()}>Cerrar MPR</button>
      </div>

      {cargando && (
        <div style={styles.loadingOverlay}>
          <h2>Reconstruyendo Volumen 3D en la GPU...</h2>
          <p>Construyendo cortes ortogonales a partir de las imágenes axiales.</p>
        </div>
      )}

      <div style={styles.gridContainer}>
        <div style={styles.viewportWrapper}>
          <div style={styles.label}>AXIAL</div>
          <div ref={axialRef} style={styles.viewport} onContextMenu={e => e.preventDefault()} />
        </div>
        <div style={styles.viewportWrapper}>
          <div style={styles.label}>CORONAL</div>
          <div ref={coronalRef} style={styles.viewport} onContextMenu={e => e.preventDefault()} />
        </div>
        <div style={styles.viewportWrapper}>
          <div style={styles.label}>SAGITAL</div>
          <div ref={sagittalRef} style={styles.viewport} onContextMenu={e => e.preventDefault()} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "#000", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", backgroundColor: "#111418", borderBottom: "1px solid #1e293b" },
  btnCerrar: { backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  gridContainer: { flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "2px", padding: "2px" },
  viewportWrapper: { position: "relative", backgroundColor: "#0f172a", border: "1px solid #1e293b" },
  viewport: { width: "100%", height: "100%", outline: "none" },
  label: { position: "absolute", top: "10px", left: "10px", color: "#fbbf24", zIndex: 10, fontSize: "12px", fontWeight: "bold", textShadow: "1px 1px 2px #000" },
  loadingOverlay: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#38bdf8" }
};