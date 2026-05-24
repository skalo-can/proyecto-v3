import React, { useEffect, useState } from "react";
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

  // Carga de datos desde el servidor
  const loadData = () => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    setLoading(true);

    // 1. Cargar Configuración
    axios.get("http://127.0.0.1:8000/api/dicom/config", { headers })
      .then((res) => {
        setForm({
          ae_title: res.data.ae_title || "",
          ip: res.data.ip || "",
          port: res.data.port || "",
          client_ae: res.data.client_ae || "",
        });
      })
      .catch(() => setError("Error al cargar configuración."));

    // 2. Cargar Estado
    axios.get("http://127.0.0.1:8000/api/dicom/status", { headers })
      .then((res) => {
        setServerStatus(res.data.running ? "LISTENING" : "STOPPED");
        setLastSender(res.data.last_event || null);
      })
      .catch(() => setServerStatus("DESCONOCIDO"));

    // 3. Cargar Logs
    axios.get("http://127.0.0.1:8000/api/dicom/logs", { headers })
      .then((res) => {
        setLogs(res.data.logs || []);
      })
      .catch(() => setLogs([{ fecha: "-", mensaje: "No hay logs disponibles." }]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = () => {
    setLoading(true);
    axios.put("http://127.0.0.1:8000/api/dicom/config", form, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
    .then(() => {
      setMessage("✅ Guardado con éxito.");
      loadData();
    })
    .catch(() => setError("❌ Error al guardar."))
    .finally(() => setLoading(false));
  };

  const handleTestConnection = () => {
    setTesting(true);
    axios.post("http://127.0.0.1:8000/api/dicom/test-connection", form, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
    .then((res) => {
      setMessage(res.data.message || "✅ Prueba exitosa.");
      loadData();
    })
    .catch(() => setError("❌ Error en la prueba."))
    .finally(() => setTesting(false));
  };

  if (!isOpen) return null;

  return (
    <div className="dicom-modal-overlay">
      <div className="dicom-modal">
        <h2 className="dicom-title">Configuración DICOM</h2>

        <div className="dicom-status-row">
          <span className="dicom-status-label">Estado del servidor:</span>
          <span className={`dicom-status-pill ${serverStatus === "LISTENING" ? "ok" : "warn"}`}>
            {serverStatus || "Cargando..."}
          </span>
        </div>

        <div className="dicom-status-row">
          <span className="dicom-status-label">Último emisor:</span>
          <span className="dicom-status-value">{lastSender || "Sin registros"}</span>
        </div>

        <div className="dicom-form-body">
          <label className="dicom-label">AE Title del servidor PACS</label>
          <input type="text" name="ae_title" value={form.ae_title} onChange={handleChange} className="dicom-input" />

          <label className="dicom-label">IP del servidor PACS</label>
          <input type="text" name="ip" value={form.ip} onChange={handleChange} className="dicom-input" />

          <label className="dicom-label">Puerto DICOM</label>
          <input type="number" name="port" value={form.port} onChange={handleChange} className="dicom-input" />

          <label className="dicom-label">AE Title del cliente (WEASIS)</label>
          <input type="text" name="client_ae" value={form.client_ae} onChange={handleChange} className="dicom-input" />
        </div>

        {message && <p className="dicom-success">{message}</p>}
        {error && <p className="dicom-error">{error}</p>}

        <div className="dicom-logs-container">
          <div className="dicom-logs-header">Logs DICOM recientes</div>
          <div className="dicom-logs-body">
            {logs.length > 0 ? logs.map((line, idx) => (
              <div key={idx} className="dicom-log-line">
                <span style={{ color: '#fbbf24', marginRight: '8px', fontSize: '0.75rem' }}>
                   [{line.fecha || '00:00'}]
                </span>
                <span style={{ fontSize: '0.8rem' }}>{line.mensaje || line}</span>
              </div>
            )) : <div className="dicom-log-line">No hay logs disponibles</div>}
          </div>
        </div>

        <div className="dicom-buttons">
          <button onClick={onClose} className="dicom-btn-close">Cerrar</button>
          <button onClick={handleTestConnection} disabled={testing} className="dicom-btn-test">
            {testing ? "Probando..." : "Probar conexión"}
          </button>
          <button onClick={handleSave} disabled={loading} className="dicom-btn-save">
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}