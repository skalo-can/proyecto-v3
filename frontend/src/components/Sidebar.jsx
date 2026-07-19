import React, { useState, useEffect } from "react"; 
import { Link, useLocation } from "react-router-dom"; 
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

// =========================================================
  // 🟢 NUEVA FUNCIÓN: SOFT RESET (Con Token Dinámico Maestro)
  // =========================================================
  const handleLimpiezaClinica = async () => {
    // 1. Ahora los administradores también pueden ver/hacer clic en el botón,
    // pero se toparán con el muro de seguridad.
    if (!isAdmin) return alert("Acceso denegado.");
    
    // 2. Primera capa: Confirmación del usuario local
    const primerFiltro = window.prompt(
      "⚠️ ATENCIÓN: Estás a punto de borrar todos los pacientes y estudios.\n\nPara iniciar, escribe la palabra LIMPIAR en mayúsculas:"
    );
    if (primerFiltro !== "LIMPIAR") {
      if (primerFiltro !== null) alert("❌ Palabra incorrecta. Operación cancelada.");
      return;
    }

// 3. Generar el Token Dinámico Maestro (HH+DD+MM+YYYY+MIN_FLAG)
    const ahora = new Date();
    
    // Hora militar: 00h se convierte en 24, el resto se mantiene (ej: 12h)
    let hh = ahora.getHours();
    const hhStr = hh === 0 ? "24" : String(hh).padStart(2, '0');
    
    // Fecha
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    
    // Flag de minutos: 01 si es < 30min, 59 si es >= 30min
    const minFlag = ahora.getMinutes() < 30 ? "01" : "59";
    
    // Token resultante: Ej: 241907202659
    const tokenMaestro = `${hhStr}${dia}${mes}${anio}${minFlag}`;

    // 4. Segunda capa: El Token de SKALO
    const tokenIngresado = window.prompt(
      "🔒 SISTEMA BLOQUEADO\n\nEsta acción requiere autorización de Nivel Maestro.\nComunícate con Soporte (SKALO) para obtener el Token Dinámico de hoy:\n\nIngrese el Token de Autorización:"
    );

    if (tokenIngresado !== tokenMaestro) {
      alert("❌ ACCESO DENEGADO: Token inválido o expirado. El incidente ha sido registrado.");
      return;
    }

    // 5. Si pasa los dos filtros, ejecutamos el borrado
    try {
      const response = await fetch("http://127.0.0.1:8000/api/reset/soft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.token}` 
        }
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ " + data.message);
        window.location.href = "/pacientes"; 
      } else {
        alert("❌ Error: " + data.message);
      }

    } catch (error) {
      console.error("Error en limpieza:", error);
      alert("❌ Fallo de conexión con el servidor al intentar limpiar el sistema.");
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
                  {/* BOTÓN CONECTADO AL SOFT RESET: Visible para Admin, protegido por Token Maestro */}
                  {isAdmin && (
                    <button 
                      className="submenu-link reset-link" 
                      onClick={handleLimpiezaClinica} 
                      style={{ 
                        color: '#ff4d4d', 
                        fontWeight: 'bold', 
                        marginTop: '10px', 
                        textAlign: 'left', 
                        background: 'transparent', 
                        border: 'none', 
                        width: '100%', 
                        cursor: 'pointer', 
                        padding: '8px 12px' 
                      }}
                    >
                      🧹 Limpiar Datos Clínicos
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