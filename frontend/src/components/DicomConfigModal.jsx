import { useEffect, useState } from "react";
import axios from "axios";
import "./DicomConfigModal.css";

export default function DicomConfigModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    ae_title: "",
    ip: "",
    port: "",
    client_ae: "",
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [serverStatus, setServerStatus] = useState(null);
  const [lastSender, setLastSender] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    axios
      .get("http://127.0.0.1:8000/api/dicom/config", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
        setForm({
          ae_title: res.data.ae_title,
          ip: res.data.ip,
          port: res.data.port,
          client_ae: res.data.client_ae,
        });
      })
      .catch(() => setError("No se pudo cargar la configuración DICOM."))
      .finally(() => setLoading(false));

    axios
      .get("http://127.0.0.1:8000/api/dicom/status", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
      setServerStatus(res.data.running ? "LISTENING" : "STOPPED");
      setLastSender(res.data.last_event || null);
      })
      .catch(() => setServerStatus("DESCONOCIDO"));

    axios
      .get("http://127.0.0.1:8000/api/dicom/logs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => setLogs(res.data.logs || []))
      .catch(() => setLogs(["No se pudieron cargar los logs."]));
  }, [isOpen]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    if (!form.ae_title.trim()) return "El AE Title del servidor es obligatorio.";
    if (!form.client_ae.trim()) return "El AE Title del cliente es obligatorio.";
    if (!form.ip.trim()) return "La IP del servidor es obligatoria.";

    const ipRegex = /^\d{1,3}(\.\d{1,3}){3}$/;
    if (!ipRegex.test(form.ip)) return "La IP no tiene un formato válido.";

    if (!form.port || form.port < 1 || form.port > 65535)
      return "El puerto debe estar entre 1 y 65535.";

    return null;
  };

  const handleSave = () => {
    const validationError = validate();
    if (validationError) return setError(validationError);

    setLoading(true);
    setMessage(null);
    setError(null);

    axios
      .put("http://127.0.0.1:8000/api/dicom/config", form, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then(() => setMessage("Configuración guardada correctamente."))
      .catch((err) =>
        setError(
          err.response?.data?.detail || "Error al guardar la configuración."
        )
      )
      .finally(() => setLoading(false));
  };

  const handleTestConnection = () => {
    const validationError = validate();
    if (validationError) return setError(validationError);

    setTesting(true);
    setMessage(null);
    setError(null);

    axios
      .post("http://127.0.0.1:8000/api/dicom/test-connection", form, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
        setMessage(res.data.message || "C‑ECHO exitoso.");
        if (res.data.logs) setLogs((prev) => [...prev, ...res.data.logs]);
      })
      .catch((err) =>
        setError(
          err.response?.data?.detail ||
            "Error al probar la conexión DICOM."
        )
      )
      .finally(() => setTesting(false));
  };

  if (!isOpen) return null;

  return (
    <div className="dicom-modal-overlay">
      <div className="dicom-modal">
        <h2 className="dicom-title">Configuración DICOM</h2>

        <div className="dicom-status-row">
          <span className="dicom-status-label">Estado del servidor:</span>
          <span
            className={
              serverStatus === "LISTENING"
                ? "dicom-status-pill ok"
                : "dicom-status-pill warn"
            }
          >
            {serverStatus || "DESCONOCIDO"}
          </span>
        </div>

        <div className="dicom-status-row">
          <span className="dicom-status-label">Último emisor:</span>
          <span className="dicom-status-value">
            {lastSender || "Sin registros"}
          </span>
        </div>

        {loading ? (
          <p className="dicom-loading">Cargando configuración...</p>
        ) : (
          <>
            <label className="dicom-label">AE Title del servidor PACS</label>
            <input
              type="text"
              name="ae_title"
              value={form.ae_title}
              onChange={handleChange}
              className="dicom-input"
            />

            <label className="dicom-label">IP del servidor PACS</label>
            <input
              type="text"
              name="ip"
              value={form.ip}
              onChange={handleChange}
              className="dicom-input"
            />

            <label className="dicom-label">Puerto DICOM</label>
            <input
              type="number"
              name="port"
              value={form.port}
              onChange={handleChange}
              className="dicom-input"
            />

            <label className="dicom-label">AE Title del cliente (WEASIS)</label>
            <input
              type="text"
              name="client_ae"
              value={form.client_ae}
              onChange={handleChange}
              className="dicom-input"
            />

            {message && <p className="dicom-success">{message}</p>}
            {error && <p className="dicom-error">{error}</p>}

            <div className="dicom-logs-container">
              <div className="dicom-logs-header">Logs DICOM recientes</div>
              <div className="dicom-logs-body">
                {logs.length > 0 ? (
                  logs.map((line, idx) => (
                    <div key={idx} className="dicom-log-line">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="dicom-log-line empty">
                    No hay logs disponibles.
                  </div>
                )}
              </div>
            </div>

            <div className="dicom-buttons">
              <button onClick={onClose} className="dicom-btn-close">
                Cerrar
              </button>

              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="dicom-btn-test"
              >
                {testing ? "Probando..." : "Probar conexión"}
              </button>

              <button
                onClick={handleSave}
                disabled={loading}
                className="dicom-btn-save"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}