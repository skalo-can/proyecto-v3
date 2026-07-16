import React, { useState, useEffect } from "react"; 
import { Link, useLocation, Outlet } from "react-router-dom"; // <-- AÑADIMOS Outlet
import { useAuth } from "../AuthContext.jsx"; 
import { FaUserPlus, FaUsersCog } from "react-icons/fa";
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth(); 

  const isActive = (path) => location.pathname === path;

  const rutasAdmin = [
    "/gestion-usuarios", 
    "/gestion-backups", 
    "/config-mapeo", 
    "/reporte-cobros", 
    "/auditoria", 
    "/email-logs", 
    "/whatsapp-logs",
    "/configuracion",
    "/perfil-institucion"
  ];

  const isAdminRoute = rutasAdmin.some(ruta => location.pathname.includes(ruta)) || location.pathname === "/";
  const [openAdmin, setOpenAdmin] = useState(isAdminRoute);

  useEffect(() => {
    if (isAdminRoute) setOpenAdmin(true);
  }, [location.pathname, isAdminRoute]);

  const currentUsername = user?.username?.trim().toUpperCase() || "";
  const isSkalo = currentUsername.includes("SKALO") || user?.rol === "superadmin";
  const isAdmin = user?.rol === "admin" || isSkalo;
  
  const isAuxiliar = user?.rol === "auxiliar";
  const isInvitado = user?.rol === "invitado";
  const isRecepcion = user?.rol === "recepcion";

  const handleResetSystem = async () => {
    if (!isSkalo) return alert("Acceso denegado.");
    const confirmacion = window.confirm("⚠️ ADVERTENCIA CRÍTICA: ¿Realmente deseas continuar?");
    if (confirmacion && window.prompt("Escribe SKALO:")?.trim().toUpperCase() === "SKALO") {
      const passwordConfirm = window.prompt("🛡️ VERIFICACIÓN FINAL:");
      if (!passwordConfirm) return;
      try {
        const response = await fetch("http://127.0.0.1:8000/api/reset/clinico", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
          body: JSON.stringify({ password: passwordConfirm }) 
        });
        if (response.ok) {
          localStorage.clear(); 
          window.location.href = "/login"; 
        }
      } catch (error) {
        alert("❌ Error de red.");
      }
    }
  };

  return (
    // 🔥 ENVOLVEMOS TODO EN UN CONTENEDOR FLEXIBLE
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}> 
      
      <div className={`sidebar-overlay ${isOpen ? "show" : ""}`} onClick={onClose} />
      
      <aside className={`sidebar ${isOpen ? "open" : ""}`} style={{ flexShrink: 0 }}>
        {/* ... TODO EL CONTENIDO DEL SIDEBAR EXACTAMENTE COMO ESTABA ... */}
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

          {(isAdmin || isRecepcion) && (
            <Link to="/recepcion" className={`sidebar-link ${isActive("/recepcion") ? "active" : ""}`} onClick={onClose}>
              <span className="icon"><FaUserPlus /></span> Recepción / RIS
            </Link>
          )}

          {(isAdmin || isInvitado) && (
            <Link to="/estadisticas" className={`sidebar-link ${isActive("/estadisticas") ? "active" : ""}`} onClick={onClose}>
              <span className="icon">📊</span> Estadísticas
            </Link>
          )}

          {isAdmin && (
            <>
              <Link to="/importar" className={`sidebar-link ${isActive("/importar") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">💿</span> Importar CD / USB
              </Link>
              <Link to="/exportar" className={`sidebar-link ${isActive("/exportar") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">📦</span> Exportar Estudios
              </Link>
            </>
          )}          

          <div className="sidebar-divider"></div>

          {(isAdmin || isAuxiliar) && (
            <div className="sidebar-section">
              <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                <span className="icon">⚙️</span> Administración {openAdmin ? "▴" : "▾"}
              </button>
              
              {openAdmin && (
                <div className="sidebar-submenu">
                  {isSkalo && (
                    <Link to="/gestion-usuarios" className={`submenu-link ${isActive("/gestion-usuarios") ? "active" : ""}`} style={{ color: '#6366f1', fontWeight: 'bold' }}>
                      <span className="icon"><FaUsersCog /></span> Gestión Usuarios
                    </Link>
                  )}
                  {isSkalo && (
                    <Link to="/" className={`submenu-link ${location.pathname === "/" ? "active" : ""}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                      ⚙️ Configuración MI_PACS
                    </Link>
                  )}
                  {isSkalo && (
                    <Link to="/gestion-backups" className={`submenu-link ${isActive("/gestion-backups") ? "active" : ""}`} style={{ color: '#10b981', fontWeight: 'bold' }}>
                      📦 Ciclo de Vida / Backups
                    </Link>
                  )}
                  {isSkalo && (
                    <Link to="/config-mapeo" className={`submenu-link ${isActive("/config-mapeo") ? "active" : ""}`} style={{ color: '#1890ff', fontWeight: '500' }}>
                      🏷️ Configurar Tags DICOM
                    </Link>
                  )}
                  <Link to="/reporte-cobros" className={`submenu-link ${isActive("/reporte-cobros") ? "active" : ""}`}>
                    📈 Reporte Cobros / Glosas
                  </Link>

                  {isAdmin && (
                    <>
                      <Link to="/auditoria" className={`submenu-link ${isActive("/auditoria") ? "active" : ""}`}>📊 Auditoría</Link>
                      <Link to="/email-logs" className={`submenu-link ${isActive("/email-logs") ? "active" : ""}`}>✉️ Logs Email</Link>
                      <Link to="/whatsapp-logs" className={`submenu-link ${isActive("/whatsapp-logs") ? "active" : ""}`}>📱 Logs WhatsApp</Link>
                    </>
                  )}

                  {isSkalo && (
                    <Link to="/perfil-institucion" className={`submenu-link ${isActive("/perfil-institucion") ? "active" : ""}`} style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                      🏥 Perfil de Institución
                    </Link>
                  )} 

                  {isSkalo && (
                    <button className="submenu-link reset-link" onClick={handleResetSystem} style={{ color: '#ff4d4d', fontWeight: 'bold', marginTop: '10px', textAlign: 'left', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', padding: '8px 12px' }}>
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

      {/* 🔥 AQUÍ ES DONDE SUCEDE LA MAGIA: El contenido principal se inyecta aquí */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet /> 
      </main>

    </div>
  );
}