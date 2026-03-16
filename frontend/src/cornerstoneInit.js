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
} from "@cornerstonejs/core";

import * as csTools from "@cornerstonejs/tools";

import * as dicomImageLoader from "@cornerstonejs/dicom-image-loader";
import * as streamingImageVolumeLoader from "@cornerstonejs/streaming-image-volume-loader";

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
  // 2. Registrar loaders
  // -------------------------------
  imageLoader.registerImageLoader("dicom", dicomImageLoader);

  volumeLoader.registerVolumeLoader(
    "cornerstoneStreamingImageVolume",
    streamingImageVolumeLoader
  );

  // -------------------------------
  // 3. Registrar metadatos
  // -------------------------------
  metaData.addProvider(dicomImageLoader.metaDataProvider);

  console.log("MI_PACS → Cornerstone3D cargado correctamente.");
}