import { Link } from "react-router-dom";
import "./Header.css";

export default function Header({ onToggleSidebar, onOpenDicom }) {
  return (
    <header className="header">
      {/* Botón hamburguesa (solo móvil) */}
      <button className="hamburger-btn" onClick={onToggleSidebar}>
        ☰
      </button>

      {/* Logo / Nombre */}
      <div className="header-title">MI_PACS</div>

      {/* Navegación desktop */}
      <nav className="header-nav">
        <Link to="/pacientes">Pacientes</Link>
        <Link to="/estudios">Estudios</Link>

        {/* Botón azul que abre la configuración DICOM */}
        <button
          id="btn-dicom-config"
          className="config-btn"
          onClick={onOpenDicom}
        >
          Configuración
        </button>

        <Link to="/logout" className="logout-btn">
          Cerrar sesión
        </Link>
      </nav>
    </header>
  );
}