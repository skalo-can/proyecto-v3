/**
- cornerstoneInit.js — MI_PACS (Cornerstone3D v5.10.8)
- ---------------------------------------------------------
- Exclusivo para el motor MPR 3D. No interfiere con el visor 2D.
 */

import {
  init as csInit,
  volumeLoader,
  imageLoader,
  metaData,
  cornerstoneStreamingImageVolumeLoader
} from "@cornerstonejs/core";

import * as csTools from "@cornerstonejs/tools";
import cornerstoneDICOMImageLoader from "@cornerstonejs/dicom-image-loader";
import dicomParser from "dicom-parser";

let initPromise = null;
let currentAuthToken = "";
let workerHangs = false;
const parsedDataSets = new Map();

export function setCornerstoneAuthToken(token) {
  currentAuthToken = (token || "").replace(/['"]+/g, "").trim();
}

function parseFloatList(str, fallback) {
  if (!str) return fallback;
  const arr = str.split("\\").map((v) => parseFloat(v.trim())).filter((n) => !Number.isNaN(n));
  return arr.length > 0 ? arr : fallback;
}

function directMetaDataProvider(type, imageId) {
  const ds = parsedDataSets.get(imageId);
  if (!ds) return undefined;

  if (type === "miPacsNativeMetadata") {
    return {
      patientName: (ds.string("x00100010") || "").replace(/\^+/g, " ").trim(),
      patientId: (ds.string("x00100020") || "").trim(),
      patientBirthDate: (ds.string("x00100030") || "").trim(),
      patientSex: (ds.string("x00100040") || "").trim(),
      modality: (ds.string("x00080060") || "CT").trim(),
      studyDate: (ds.string("x00080020") || "").trim(),
      studyTime: (ds.string("x00080030") || "").trim(),
      studyDescription: (ds.string("x00081030") || "").trim(),
      seriesDescription: (ds.string("x0008103e") || "").trim(),
      seriesNumber: (ds.string("x00200011") || "").trim(),
      institutionName: (ds.string("x00080080") || "").trim(),
      sliceThickness: parseFloat(ds.string("x00180050")) || null,
      rows: ds.uint16("x00280010") || 512,
      columns: ds.uint16("x00280011") || 512,
    };
  }

  if (type === "patientModule") {
    return {
      patientName: (ds.string("x00100010") || "").trim(),
      patientId: (ds.string("x00100020") || "").trim(),
      patientBirthDate: (ds.string("x00100030") || "").trim(),
      patientSex: (ds.string("x00100040") || "").trim(),
    };
  }

  if (type === "generalStudyModule") {
    return {
      studyDate: (ds.string("x00080020") || "").trim(),
      studyTime: (ds.string("x00080030") || "").trim(),
      studyDescription: (ds.string("x00081030") || "").trim(),
      accessionNumber: (ds.string("x00080050") || "").trim(),
    };
  }

  if (type === "imagePixelModule") {
    const rows = ds.uint16("x00280010") || 512;
    const columns = ds.uint16("x00280011") || 512;
    const bitsAllocated = ds._miPacsFloat32 ? 32 : (ds.uint16("x00280100") || 16);
    const bitsStored = ds._miPacsFloat32 ? 32 : (ds.uint16("x00280101") || bitsAllocated);
    const highBit = ds._miPacsFloat32 ? 31 : (ds.uint16("x00280102") ?? bitsStored - 1);
    const pixelRepresentation = ds._miPacsPreScaled ? 1 : (ds.uint16("x00280103") ?? 0);
    const samplesPerPixel = ds.uint16("x00280002") || 1;
    const photometricInterpretation = (ds.string("x00280004") || "MONOCHROME2").trim();

    return {
      samplesPerPixel,
      photometricInterpretation,
      rows,
      columns,
      bitsAllocated,
      bitsStored,
      highBit,
      pixelRepresentation,
      smallestPixelValue: ds.uint16("x00280106"),
      largestPixelValue: ds.uint16("x00280107"),
    };
  }

  if (type === "imagePlaneModule") {
    const rows = ds.uint16("x00280010") || 512;
    const columns = ds.uint16("x00280011") || 512;
    const pixelSpacing = parseFloatList(ds.string("x00280030"), [1, 1]);
    const iop = parseFloatList(ds.string("x00200037"), [1, 0, 0, 0, 1, 0]);
    const ipp = parseFloatList(ds.string("x00200032"), [0, 0, 0]);
    const sliceThickness = parseFloat(ds.string("x00180050")) || 1;
    const spacingBetweenSlices = parseFloat(ds.string("x00180088")) || sliceThickness;
    const sliceLocation = parseFloat(ds.string("x00201041"));

    return {
      rows,
      columns,
      pixelSpacing,
      rowPixelSpacing: pixelSpacing[0],
      columnPixelSpacing: pixelSpacing[1] ?? pixelSpacing[0],
      rowCosines: [iop[0], iop[1], iop[2]],
      columnCosines: [iop[3], iop[4], iop[5]],
      imageOrientationPatient: iop,
      imagePositionPatient: ipp,
      sliceThickness,
      spacingBetweenSlices,
      sliceLocation: Number.isNaN(sliceLocation) ? undefined : sliceLocation,
      frameOfReferenceUID: (ds.string("x00200052") || "1.2.3.4.5").trim(),
    };
  }

  if (type === "modalityLutModule") {
    if (ds._miPacsPreScaled) {
      return {
        rescaleIntercept: 0,
        rescaleSlope: 1,
        rescaleType: (ds.string("x00281054") || "HU").trim(),
      };
    }
    const rescaleIntercept = parseFloat(ds.string("x00281052"));
    const rescaleSlope = parseFloat(ds.string("x00281053"));
    return {
      rescaleIntercept: Number.isNaN(rescaleIntercept) ? 0 : rescaleIntercept,
      rescaleSlope: Number.isNaN(rescaleSlope) ? 1 : rescaleSlope,
      rescaleType: (ds.string("x00281054") || "HU").trim(),
    };
  }

  if (type === "voiLutModule") {
    const wc = parseFloatList(ds.string("x00281050"), [40]);
    const ww = parseFloatList(ds.string("x00281051"), [400]);
    return {
      windowCenter: wc,
      windowWidth: ww,
    };
  }

  if (type === "generalSeriesModule") {
    return {
      modality: (ds.string("x00080060") || "CT").trim(),
      seriesInstanceUID: (ds.string("x0020000e") || "").trim(),
      seriesNumber: parseInt(ds.string("x00200011") || "1", 10),
      seriesDescription: (ds.string("x0008103e") || "").trim(),
    };
  }

  if (type === "generalImageModule") {
    return {
      instanceNumber: parseInt(ds.string("x00200013") || "1", 10),
    };
  }

  if (type === "sopCommonModule") {
    return {
      sopClassUID: (ds.string("x00080016") || "").trim(),
      sopInstanceUID: (ds.string("x00080018") || "").trim(),
    };
  }

  return undefined;
}

function loadImageDirectWithDicomParser(imageId) {
  const parser = dicomParser.default || dicomParser;
  const url = imageId.replace(/^wadouri:/, "");
  const token =
    currentAuthToken ||
    (localStorage.getItem("access_token") || localStorage.getItem("token") || "")
      .replace(/['"]+/g, "")
      .trim();

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const promise = fetch(url, { headers })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} descargando corte DICOM`);
      return res.arrayBuffer();
    })
    .then((arrayBuffer) => {
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = parser.parseDicom(byteArray);

      const rows = dataSet.uint16("x00280010") || 512;
      const columns = dataSet.uint16("x00280011") || 512;
      const bitsAllocated = dataSet.uint16("x00280100") || 16;
      const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
      const photometric = (dataSet.string("x00280004") || "MONOCHROME2").trim();
      const pixelSpacing = parseFloatList(dataSet.string("x00280030"), [1, 1]);
      const rawIntercept = parseFloat(dataSet.string("x00281052"));
      const rawSlope = parseFloat(dataSet.string("x00281053"));
      const effectiveIntercept = Number.isNaN(rawIntercept) ? 0 : rawIntercept;
      const effectiveSlope = Number.isNaN(rawSlope) ? 1 : rawSlope;
      const wc = parseFloatList(dataSet.string("x00281050"), [40]);
      const ww = parseFloatList(dataSet.string("x00281051"), [400]);

      const pixelElement = dataSet.elements.x7fe00010;
      if (!pixelElement) {
        throw new Error("El archivo DICOM no contiene tag de píxeles (7FE0,0010)");
      }
      if (pixelElement.encapsulatedPixelData) {
        throw new Error("Sintaxis DICOM comprimida: requiere decodificador nativo.");
      }

      const alignedBuffer = byteArray.buffer.slice(
        byteArray.byteOffset + pixelElement.dataOffset,
        byteArray.byteOffset + pixelElement.dataOffset + pixelElement.length
      );

      let rawPixelData;
      if (bitsAllocated === 16) {
        rawPixelData = pixelRepresentation === 1
          ? new Int16Array(alignedBuffer)
          : new Uint16Array(alignedBuffer);
      } else {
        rawPixelData = new Uint8Array(alignedBuffer);
      }

      // Convertir píxeles crudos a Unidades Hounsfield reales (HU = raw * slope + intercept)
      let pixelData = rawPixelData;
      if (effectiveSlope !== 1 || effectiveIntercept !== 0) {
        const useFloat = !Number.isInteger(effectiveSlope) || !Number.isInteger(effectiveIntercept);
        pixelData = useFloat
          ? new Float32Array(rawPixelData.length)
          : new Int16Array(rawPixelData.length);

        for (let i = 0; i < rawPixelData.length; i++) {
          pixelData[i] = rawPixelData[i] * effectiveSlope + effectiveIntercept;
        }
        dataSet._miPacsPreScaled = true;
        dataSet._miPacsFloat32 = useFloat;
      }

      parsedDataSets.set(imageId, dataSet);

      let minPixelValue = Infinity;
      let maxPixelValue = -Infinity;
      for (let i = 0; i < pixelData.length; i += 4) {
        const v = pixelData[i];
        if (v < minPixelValue) minPixelValue = v;
        if (v > maxPixelValue) maxPixelValue = v;
      }

      return {
        imageId,
        minPixelValue: Number.isFinite(minPixelValue) ? minPixelValue : -1024,
        maxPixelValue: Number.isFinite(maxPixelValue) ? maxPixelValue : 3071,
        slope: 1,
        intercept: 0,
        windowCenter: wc[0],
        windowWidth: ww[0],
        getPixelData: () => pixelData,
        rows,
        columns,
        height: rows,
        width: columns,
        color: false,
        rgba: false,
        columnPixelSpacing: pixelSpacing[1] ?? pixelSpacing[0],
        rowPixelSpacing: pixelSpacing[0],
        invert: photometric === "MONOCHROME1",
        sizeInBytes: pixelData.byteLength,
      };
    });

  return {
    promise,
    cancelFn: () => {},
    decache: () => parsedDataSets.delete(imageId),
  };
}

export function initCornerstone() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log("MI_PACS → Inicializando Cornerstone3D...");

    await csInit();
    csTools.init();

    // 1. Registrar herramientas 3D disponibles
    const toolCandidates = [
      "PanTool",
      "ZoomTool",
      "WindowLevelTool",
      "StackScrollTool",
      "LengthTool",
      "AngleTool",
      "RectangleROITool",
      "EllipticalROITool",
      "CrosshairsTool",
    ];

    toolCandidates.forEach((name) => {
      const tool =
        csTools[name] ||
        csTools.Tools?.[name] ||
        csTools[name.replace("Tool", "")] ||
        null;

      if (tool) {
        try {
          csTools.addTool(tool);
        } catch (e) {}
      }
    });

    // 2. Configurar autenticación y WebWorkers en @cornerstonejs/dicom-image-loader v5
    const dicomLoader = cornerstoneDICOMImageLoader.default || cornerstoneDICOMImageLoader;

    const beforeSend = (xhr) => {
      const token =
        currentAuthToken ||
        (localStorage.getItem("access_token") || localStorage.getItem("token") || "")
          .replace(/['"]+/g, "")
          .trim();

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
    };

    if (typeof dicomLoader.init === "function") {
      try {
        await dicomLoader.init({
          maxWebWorkers: Math.min(navigator.hardwareConcurrency || 2, 2),
          beforeSend,
        });
      } catch (e) {
        console.warn("MI_PACS → Aviso inicializando dicomLoader:", e);
      }
    }

    if (typeof dicomLoader.setOptions === "function") {
      dicomLoader.setOptions({ beforeSend });
    }
    if (dicomLoader.internal && typeof dicomLoader.internal.setOptions === "function") {
      dicomLoader.internal.setOptions({ beforeSend });
    }

    // 3. Registrar proveedores de metadatos
    const nativeProvider =
      dicomLoader.wadouri?.metaData?.metaDataProvider ||
      dicomLoader.wadouri?.metaDataProvider ||
      dicomLoader.metaDataProvider;

    if (typeof nativeProvider === "function") {
      metaData.addProvider(nativeProvider, 9999);
    }
    metaData.addProvider(directMetaDataProvider, 10001);

    // 4. Registrar wadouri con detección automática de worker bloqueado
    imageLoader.registerImageLoader("wadouri", (imageId) => {
      if (workerHangs || !dicomLoader.wadouri?.loadImage) {
        return loadImageDirectWithDicomParser(imageId);
      }

      const nativeTask = dicomLoader.wadouri.loadImage(imageId);
      const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          console.warn("MI_PACS → WebWorker DICOM sin respuesta en Vite; cambiando a decodificación directa.");
          workerHangs = true;
          loadImageDirectWithDicomParser(imageId).promise.then(resolve, reject);
        }, 2500);

        nativeTask.promise.then(
          (img) => {
            clearTimeout(timer);
            resolve(img);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

      return {
        promise,
        cancelFn: nativeTask.cancelFn || (() => {}),
        decache: nativeTask.decache || (() => {}),
      };
    });

    // 5. Registrar cargador de volúmenes nativo de @cornerstonejs/core v5
    volumeLoader.registerVolumeLoader(
      "cornerstoneStreamingImageVolume",
      cornerstoneStreamingImageVolumeLoader
    );
    volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader);

    console.log("MI_PACS → Cornerstone3D cargado correctamente.");
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}