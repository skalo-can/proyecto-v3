import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import axios from "axios";
import DicomConfigModal from "../components/DicomConfigModal";
import "./SystemConfig.css";

export default function SystemConfig() {
  const { user } = useAuth();

  const [showDicomModal, setShowDicomModal] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  /* ============================
     Cargar estado del sistema
  ============================ */
  useEffect(() => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:8000/status")
      .then((res) => setSystemInfo(res.data))
      .catch(() => setError("No se pudo obtener el estado del sistema."))
      .finally(() => setLoading(false));
  }, []);

  /* ============================
     Mensajes temporales
  ============================ */
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  /* ============================
     Acciones de mantenimiento
  ============================ */
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

  /* ============================
     Resetear Base de Datos
     (Solo superadmin)
  ============================ */
  const resetDatabase = () => {
    if (!window.confirm("⚠️ ¿Seguro que deseas resetear toda la base de datos? Esta acción es irreversible.")) return;
    if (!window.confirm("⚠️ Confirmación final: Se eliminarán TODOS los pacientes, estudios y archivos. ¿Continuar?")) return;

    fetch("http://localhost:8000/admin/reset-db", { method: "POST" })
      .then(() => alert("Base de datos reseteada correctamente."))
      .catch(() => alert("Error al resetear la base de datos."));
  };

  return (
    <div className="config-container">

      <h1 className="config-title">Configuración MI PACS</h1>

      {message && <p className="msg success">{message}</p>}
      {error && <p className="msg error">{error}</p>}

      {/* ============================
          Panel DICOM
      ============================ */}
      <div className="glass-panel">
        <h2>Configuración DICOM</h2>
        <p>Ajusta los parámetros de comunicación DICOM del servidor MI_PACS.</p>

        <button
          onClick={() => setShowDicomModal(true)}
          className="btn-primary"
        >
          Abrir configuración DICOM
        </button>
      </div>

      {/* ============================
          Información del sistema
      ============================ */}
      <div className="glass-panel">
        <h2>Información del Sistema</h2>

        {loading ? (
          <p>Cargando información...</p>
        ) : (
          <div>
            <p><strong>Estado:</strong> {systemInfo?.message || "Desconocido"}</p>
            <p><strong>Backend:</strong> http://127.0.0.1:8000</p>
            <p><strong>Frontend:</strong> http://127.0.0.1:5173</p>
            <p><strong>Versión MI_PACS:</strong> 3.0</p>
          </div>
        )}
      </div>

      {/* ============================
          Mantenimiento del sistema
      ============================ */}
      <div className="glass-panel">
        <h2>Mantenimiento del Sistema</h2>

        <div className="btn-group">
          <button onClick={limpiarThumbnails} className="btn-secondary">
            Limpiar thumbnails
          </button>

          <button onClick={limpiarInbox} className="btn-secondary">
            Limpiar inbox DICOM
          </button>

          <button onClick={reiniciarServicios} className="btn-danger">
            Reiniciar servicios
          </button>
        </div>
      </div>

      {/* ============================
          Panel Avanzado (solo superadmin)
      ============================ */}
      {user?.role === "superadmin" && (
        <div className="glass-panel danger-zone">
          <h2 className="danger-title">⚠️ Herramientas Avanzadas</h2>
          <p className="danger-text">
            Estas acciones son extremadamente sensibles. Úsalas solo si sabes exactamente lo que estás haciendo.
          </p>

          <button className="danger-btn" onClick={resetDatabase}>
            🔥 Resetear Base de Datos
          </button>
        </div>
      )}

      <DicomConfigModal
        isOpen={showDicomModal}
        onClose={() => setShowDicomModal(false)}
      />
    </div>
  );
}