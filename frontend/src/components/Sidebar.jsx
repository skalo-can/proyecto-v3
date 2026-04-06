import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../AuthContext.jsx"; 
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose, onAction }) {
  const location = useLocation();
  const { user } = useAuth();
  const [openAdmin, setOpenAdmin] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Lógica de permisos intacta
  const isSkalo = user?.username === "SKALO" || user?.rol === "superadmin";
  const isAdmin = user?.rol === "admin" || isSkalo;

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? "show" : ""}`} onClick={onClose} />
      
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-subtitle">MI_PACS SYSTEM</span>
          <br />
          <small style={{ color: '#fbbf24', fontWeight: 'bold' }}>
            {isSkalo ? "🚀 MODO MAESTRO" : `🛡️ ${user?.rol?.toUpperCase()}`}
          </small>
        </div>

        <nav className="sidebar-nav">
          {/* SECCIÓN CLÍNICA */}
          <Link to="/pacientes" className={`sidebar-link ${isActive("/pacientes") ? "active" : ""}`}>
            <span className="icon">👥</span> Pacientes
          </Link>

          {/* Botón Estadísticas actualizado */}
          {isAdmin && (
            <Link to="/estadisticas" className={`sidebar-link ${isActive("/estadisticas") ? "active" : ""}`}>
              <span className="icon">📊</span> Estadísticas
            </Link>
          )}

          <div className="sidebar-divider"></div>

          {/* PANEL DE ADMINISTRACIÓN */}
          {isAdmin && (
            <div className="sidebar-section">
              <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                <span className="icon">⚙️</span> Administración {openAdmin ? "▴" : "▾"}
              </button>
              
              {openAdmin && (
                <div className="sidebar-submenu">
                  {isSkalo && (
                    <Link to="/configuracion" className="submenu-link" style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                      ⚙️ Configuración MI_PACS
                    </Link>
                  )}

                  {/* CONEXIÓN AL REPORTE DE COBROS CORREGIDA */}
                  <Link 
                    to="/reporte-cobros" 
                    className={`submenu-link ${isActive("/reporte-cobros") ? "active" : ""}`}
                  >
                    📈 Reporte Cobros
                  </Link>

                  <Link to="/auditoria" className="submenu-link">📊 Auditoría</Link>
                  <Link to="/email-logs" className="submenu-link">✉️ Logs Email</Link>
                  <Link to="/whatsapp-logs" className="submenu-link">📱 Logs WhatsApp</Link>
                  
                  {isSkalo && (
                    <button 
                      className="submenu-link reset-link" 
                      onClick={() => onAction("resetDB")}
                      style={{ color: '#ff4d4d', fontWeight: 'bold', marginTop: '10px' }}
                    >
                      ⚠️ Resetear Sistema
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <Link to="/logout" className="sidebar-link logout-btn" style={{ color: '#ff4d4d', marginTop: '20px' }}>
            <span className="icon">🚪</span> Cerrar Sesión
          </Link>
        </nav>
      </aside>
    </>
  );
}