/**
 * cornerstoneInit.js — MI_PACS (UNIVERSAL)
 * ---------------------------------------------------------
 * Esta versión detecta automáticamente dónde están las herramientas
 * y evita que el visor explote si alguna no existe.
 */

import {
  init as csInit,
  volumeLoader,
  imageLoader,
  metaData,
  cornerstoneStreamingImageVolumeLoader 
} from "@cornerstonejs/core";

import * as csTools from "@cornerstonejs/tools";
// 🚀 FIX: Importación por defecto para evitar problemas de desestructuración
import cornerstoneDICOMImageLoader from "@cornerstonejs/dicom-image-loader";

export async function initCornerstone() {
  console.log("MI_PACS → Inicializando Cornerstone3D...");

  await csInit();
  csTools.init();

  // -------------------------------
  // 1. Detectar herramientas reales
  // -------------------------------
  const toolCandidates = [
  "PanTool",
  "ZoomTool",
  "WindowLevelTool",
  "StackScrollTool",
  "LengthTool",
  "AngleTool",
  "RectangleROITool",
  "EllipticalROITool",
  ];

  const addTool = csTools.addTool;

  toolCandidates.forEach((name) => {
    const tool =
      csTools[name] ||
      csTools.Tools?.[name] ||
      csTools[name.replace("Tool", "")] ||
      null;

    if (tool) {
      console.log(`MI_PACS → Registrando herramienta: ${name}`);
      addTool(tool);
    } else {
      console.warn(`MI_PACS → Herramienta NO encontrada: ${name}`);
    }
  });

  // -------------------------------
  // 2. Extraer el loader seguro (Protección contra Vite)
  // -------------------------------
  const dicomLoader = cornerstoneDICOMImageLoader.default || cornerstoneDICOMImageLoader;

  // -------------------------------
  // 3. Registrar loaders
  // -------------------------------
  imageLoader.registerImageLoader("dicom", dicomLoader);

  volumeLoader.registerVolumeLoader(
    "cornerstoneStreamingImageVolume",
    cornerstoneStreamingImageVolumeLoader
  );
  volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader);

  // -------------------------------
  // 4. Registrar metadatos (Blindado contra errores undefined)
  // -------------------------------
  if (dicomLoader.wadouri && typeof dicomLoader.wadouri.metaDataProvider === 'function') {
    // Para conexiones WADO-URI clásicas
    metaData.addProvider(dicomLoader.wadouri.metaDataProvider, 9999);
  }

  console.log("MI_PACS → Cornerstone3D cargado correctamente.");
}