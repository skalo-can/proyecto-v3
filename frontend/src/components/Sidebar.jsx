import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose, onAction }) {
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <>
      {/* Overlay SOLO para móvil */}
      <div
        className={`sidebar-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      {/* SIDEBAR FIJO EN ESCRITORIO + DESLIZABLE EN MÓVIL */}
      <aside className={`sidebar glass-sidebar ${isOpen ? "open" : ""}`}>
        <nav className="sidebar-nav">

          <Link
            to="/pacientes"
            className={`sidebar-link ${isActive("/pacientes") ? "active" : ""}`}
            style={{ marginBottom: "12px" }}   // separación clínica
          >
            <span className="icon">👤</span>
            Pacientes
          </Link>

          <Link
            to="/estudios"
            className={`sidebar-link ${isActive("/estudios") ? "active" : ""}`}
          >
            <span className="icon">🩻</span>
            Estudios
          </Link>

        </nav>

        {/* PANEL DE ACCIONES DEL ESTUDIO */}
        <div className="sidebar-actions">
          <h3>Acciones del Estudio</h3>

          <button className="btn btn-primary" onClick={() => onAction("link")}>
            🔗 Generar enlace seguro
          </button>

          <button className="btn btn-success" onClick={() => onAction("whatsapp")}>
            📱 Enviar por WhatsApp
          </button>

          <button className="btn btn-warning" onClick={() => onAction("pdf")}>
            📄 Generar PDF
          </button>

          <button className="btn btn-info" onClick={() => onAction("auditoria")}>
            📊 Ver auditoría
          </button>

          <button className="btn btn-info" onClick={() => onAction("emailLogs")}>
            ✉️ Ver logs de email
          </button>

          <button className="btn btn-info" onClick={() => onAction("secureLinks")}>
            🔐 Ver enlaces seguros
          </button>

          <button className="btn btn-info" onClick={() => onAction("whatsappPanel")}>
            📱 Panel WhatsApp
          </button>

          <button className="btn btn-info" onClick={() => onAction("pdfPanel")}>
            📄 Panel PDF
          </button>

          <button className="btn btn-email" onClick={() => onAction("email")}>
            ✉️ Enviar por Email
          </button>
        </div>
      </aside>
    </>
  );
}