import React, { useState } from "react"; 
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx"; 
import { FaUserPlus, FaUsersCog } from "react-icons/fa";
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth(); // Asumimos que AuthContext entrega el token
  const [openAdmin, setOpenAdmin] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Identificación Maestra
  const currentUsername = user?.username?.trim().toUpperCase() || "";
  const isSkalo = currentUsername.includes("SKALO") || user?.rol === "superadmin";
  const isAdmin = user?.rol === "admin" || isSkalo;

  // 🔥 LÓGICA DE RESETEO CORREGIDA
  const handleResetSystem = async () => {
    if (!isSkalo) {
      alert(`Acceso denegado. Solo el usuario Maestro SKALO tiene permisos.`);
      return;
    }

    const confirmacion = window.confirm(
      "⚠️ ADVERTENCIA CRÍTICA: Estás a punto de borrar todos los datos del sistema (Pacientes, Estudios e Imágenes). ¿Realmente deseas continuar?"
    );

    if (confirmacion) {
      const palabraMaestra = window.prompt(
        "Para proceder, confirma escribiendo la palabra maestra (SKALO):"
      );

      if (palabraMaestra?.trim().toUpperCase() === "SKALO") {
        const passwordConfirm = window.prompt(
          "🛡️ VERIFICACIÓN FINAL: Ingresa tu contraseña de acceso para autorizar el reseteo:"
        );

        if (!passwordConfirm) return;

        try {
          // CAMBIADO: URL exacta del endpoint que definimos en el Backend
          const response = await fetch("http://127.0.0.1:8000/api/reset/clinico", {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user?.token}` 
            },
            // Enviamos el password para que el backend lo valide
            body: JSON.stringify({ password: passwordConfirm }) 
          });

          if (response.ok) {
            alert("✅ SISTEMA RESETEADO EXITOSAMENTE. La página se recargará.");
            localStorage.clear(); // Limpiamos sesión vieja
            window.location.href = "/login"; // Redirección total
          } else {
            const errorData = await response.json();
            alert(`❌ ERROR: ${errorData.detail || 'Fallo de autorización'}`);
          }
        } catch (error) {
          console.error("Error en reset:", error);
          alert("❌ Error de red: No se pudo conectar con el servidor.");
        }
      }
    }
  };

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
          <Link to="/pacientes" className={`sidebar-link ${isActive("/pacientes") ? "active" : ""}`} onClick={onClose}>
            <span className="icon">👥</span> Pacientes
          </Link>

          <Link to="/recepcion" className={`sidebar-link ${isActive("/recepcion") ? "active" : ""}`} onClick={onClose}>
            <span className="icon"><FaUserPlus /></span> Recepción / RIS
          </Link>

          {isAdmin && (
            <Link to="/estadisticas" className={`sidebar-link ${isActive("/estadisticas") ? "active" : ""}`} onClick={onClose}>
              <span className="icon">📊</span> Estadísticas
            </Link>
          )}

          <div className="sidebar-divider"></div>

          {isAdmin && (
            <div className="sidebar-section">
              <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                <span className="icon">⚙️</span> Administración {openAdmin ? "▴" : "▾"}
              </button>
              
              {openAdmin && (
                <div className="sidebar-submenu">
                  <Link to="/gestion-usuarios" className={`submenu-link ${isActive("/gestion-usuarios") ? "active" : ""}`} onClick={onClose} style={{ color: '#6366f1', fontWeight: 'bold' }}>
                    <span className="icon"><FaUsersCog /></span> Gestión Usuarios
                  </Link>

                  {isSkalo && (
                    <Link to="/configuracion" className="submenu-link" style={{ color: '#fbbf24', fontWeight: 'bold' }} onClick={onClose}>
                      ⚙️ Configuración MI_PACS
                    </Link>
                  )}

                  <Link to="/config-mapeo" className={`submenu-link ${isActive("/config-mapeo") ? "active" : ""}`} onClick={onClose} style={{ color: '#1890ff', fontWeight: '500' }}>
                    🏷️ Configurar Tags DICOM
                  </Link>

                  <Link to="/reporte-cobros" className={`submenu-link ${isActive("/reporte-cobros") ? "active" : ""}`} onClick={onClose}>
                    📈 Reporte Cobros
                  </Link>

                  <Link to="/auditoria" className="submenu-link" onClick={onClose}>📊 Auditoría</Link>
                  <Link to="/email-logs" className="submenu-link" onClick={onClose}>✉️ Logs Email</Link>
                  <Link to="/whatsapp-logs" className="submenu-link" onClick={onClose}>📱 Logs WhatsApp</Link>
                  
                  {isSkalo && (
                    <button className="submenu-link reset-link" onClick={handleResetSystem} 
                      style={{ color: '#ff4d4d', fontWeight: 'bold', marginTop: '10px', textAlign: 'left', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', padding: '8px 12px' }}>
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