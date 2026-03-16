const element = document.getElementById("dicom-viewer");

// Configurar dependencias
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = window.Hammer;

// Inicializar cornerstoneTools
cornerstoneTools.init();

// Inicializar WebWorkers del loader WADO
cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: 1,
    startWebWorkersOnDemand: true,
    webWorkerPath: 'https://cdn.jsdelivr.net/npm/cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderWebWorker.min.js',
    taskConfiguration: {
        decodeTask: {
            codecsPath: 'https://cdn.jsdelivr.net/npm/cornerstone-wado-image-loader/dist/cornerstoneWADOImageLoaderCodecs.min.js'
        }
    }
});

// Activar el visor
cornerstone.enable(element);

// IDs de prueba
const estudioId = 1;
const imagenId = 1;

const imageId = `wadouri:http://127.0.0.1:8000/estudios/${estudioId}/dicom/${imagenId}`;

// Cargar y mostrar la imagen
cornerstone.loadImage(imageId).then(image => {
    cornerstone.displayImage(element, image);
}).catch(error => {
    console.error("Error al cargar el DICOM:", error);
});