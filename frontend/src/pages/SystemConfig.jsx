import { useState, useEffect } from "react";
import axios from "axios";
import DicomConfigModal from "../components/DicomConfigModal";

export default function SystemConfig() {
    const [showDicomModal, setShowDicomModal] = useState(false);
    const [systemInfo, setSystemInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        axios
            .get("http://127.0.0.1:8000/status")
            .then((res) => setSystemInfo(res.data))
            .catch(() => setError("No se pudo obtener el estado del sistema."))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (message || error) {
            const timer = setTimeout(() => {
                setMessage(null);
                setError(null);
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [message, error]);

    const limpiarThumbnails = () => {
        axios
            .post("http://127.0.0.1:8000/api/reset/thumbnails")
            .then(() => setMessage("Thumbnails limpiados correctamente."))
            .catch(() => setError("Error al limpiar thumbnails."));
    };

    const limpiarInbox = () => {
        axios
            .post("http://127.0.0.1:8000/api/reset/inbox")
            .then(() => setMessage("Inbox DICOM limpiado correctamente."))
            .catch(() => setError("Error al limpiar inbox."));
    };

    const reiniciarServicios = () => {
        axios
            .post("http://127.0.0.1:8000/api/reset/restart-services")
            .then(() => setMessage("Servicios reiniciados correctamente."))
            .catch(() => setError("Error al reiniciar servicios."));
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">
                Configuración del Sistema
            </h1>

            {message && (
                <p className="text-green-600 font-semibold mb-4">{message}</p>
            )}
            {error && (
                <p className="text-red-600 font-semibold mb-4">{error}</p>
            )}

            <div className="bg-white shadow rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                    Configuración DICOM
                </h2>

                <p className="text-gray-600 mb-4">
                    Ajusta los parámetros de comunicación DICOM del servidor MI_PACS.
                </p>

                <button
                    onClick={() => setShowDicomModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Abrir configuración DICOM
                </button>
            </div>

            <div className="bg-white shadow rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                    Información del Sistema
                </h2>

                {loading ? (
                    <p className="text-gray-600">Cargando información...</p>
                ) : (
                    <div className="text-gray-700">
                        <p>
                            <strong>Estado:</strong>{" "}
                            {systemInfo?.message || "Desconocido"}
                        </p>
                        <p>
                            <strong>Backend:</strong> http://127.0.0.1:8000
                        </p>
                        <p>
                            <strong>Frontend:</strong> http://127.0.0.1:5173
                        </p>
                        <p>
                            <strong>Versión MI_PACS:</strong> 3.0
                        </p>
                    </div>
                )}
            </div>

            <div className="bg-white shadow rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                    Mantenimiento del Sistema
                </h2>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={limpiarThumbnails}
                        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
                    >
                        Limpiar thumbnails
                    </button>

                    <button
                        onClick={limpiarInbox}
                        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
                    >
                        Limpiar inbox DICOM
                    </button>

                    <button
                        onClick={reiniciarServicios}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Reiniciar servicios
                    </button>
                </div>
            </div>

            <DicomConfigModal
                isOpen={showDicomModal}
                onClose={() => setShowDicomModal(false)}
            />
        </div>
    );
}