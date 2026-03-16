import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  const linkStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 18px",
    textDecoration: "none",
    color: location.pathname.startsWith(path) ? "#0ea5e9" : "#334155",
    backgroundColor: location.pathname.startsWith(path)
      ? "#f0f9ff"
      : "transparent",
    borderRadius: "8px",
    fontWeight: "500",
    transition: "all 0.2s",
  });

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={`sidebar-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <nav className="sidebar-nav">
          <Link to="/pacientes" style={linkStyle("/pacientes")}>
            👤 Pacientes
          </Link>

          <Link to="/estudios" style={linkStyle("/estudios")}>
            🩻 Estudios
          </Link>

          <Link to="/logout" style={linkStyle("/logout")}>
            🚪 Cerrar sesión
          </Link>
        </nav>
      </aside>
    </>
  );
}