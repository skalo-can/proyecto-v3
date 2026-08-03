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
    "/recuperar-backups", 
    "/config-mapeo", 
    "/facturacion-servicio", 
    "/auditoria", 
    "/email-logs", 
    "/whatsapp-logs",
    "/configuracion",
    "/perfil-institucion",
    "/gestion-firmas"
  ];

  const isAdminRoute = rutasAdmin.some(ruta => location.pathname.includes(ruta)) || location.pathname === "/";
  const [openAdmin, setOpenAdmin] = useState(isAdminRoute);

  useEffect(() => {
    if (isAdminRoute) setOpenAdmin(true);
  }, [location.pathname, isAdminRoute]);

  const userRol = String(user?.rol || "").toLowerCase().trim();
  const currentUsername = String(user?.username || user?.nombre || "").trim().toUpperCase();
  
  const isSkalo = currentUsername.includes("SKALO") || userRol === "superadmin";
  const isAdmin = userRol === "admin" || isSkalo;
  const isAuxiliar = userRol === "auxiliar";
  const isInvitado = userRol === "invitado";
  const isRecepcion = userRol === "recepcion";
  const isTecnologo = userRol === "tecnologo"; 
  const esUrgenciologo = user?.es_urgenciologo === true;

  const handleLimpiezaClinica = async () => {
    if (!isAdmin) return alert("Acceso denegado.");
    
    const primerFiltro = window.prompt(
      "⚠️ ATENCIÓN: Estás a punto de borrar todos los pacientes y estudios.\n\nPara iniciar, escribe la palabra LIMPIAR en mayúsculas:"
    );
    if (primerFiltro !== "LIMPIAR") {
      if (primerFiltro !== null) alert("❌ Palabra incorrecta. Operación cancelada.");
      return;
    }

    const ahora = new Date();
    let hh = ahora.getHours();
    const hhStr = hh === 0 ? "24" : String(hh).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    const minFlag = ahora.getMinutes() < 30 ? "01" : "59";
    const tokenMaestro = `${hhStr}${dia}${mes}${anio}${minFlag}`;

    const tokenIngresado = window.prompt(
      "🔒 SISTEMA BLOQUEADO\n\nEsta acción requiere autorización de Nivel Maestro.\nComunícate con Soporte (SKALO) para obtener el Token Dinámico de hoy:\n\nIngrese el Token de Autorización:"
    );

    if (tokenIngresado !== tokenMaestro) {
      alert("❌ ACCESO DENEGADO: Token inválido o expirado. El incidente ha sido registrado.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/reset/soft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      const data = await response.json();
      if (data.success) { alert("✅ " + data.message); window.location.href = "/pacientes"; } 
      else { alert("❌ Error: " + data.message); }
    } catch (error) {
      alert("❌ Fallo de conexión con el servidor al intentar limpiar el sistema.");
    }
  };

  return (
    <> 
      <div className={`sidebar-overlay ${isOpen ? "show" : ""}`} onClick={onClose} />
      
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        
        {/* CABECERA */}
        <div className="sidebar-header">
          <span className="sidebar-subtitle">MI_PACS SYSTEM</span>
          <br />
          <small className={esUrgenciologo ? "urgencia-badge" : ""} style={{ color: esUrgenciologo ? '#ef4444' : '#fbbf24', fontWeight: 'bold' }}>
            {isSkalo ? "🚀 MODO MAESTRO" : esUrgenciologo ? "🚨 MÉD. URGENCIAS" : `🛡️ ${userRol.toUpperCase()}`}
          </small>
        </div>

        {/* ZONA DE NAVEGACIÓN GLOBAL CON SCROLL SUAVE */}
        <div className="sidebar-scroll-area admin-scroll-zone">
          <nav className="sidebar-nav">
            
            <Link to="/pacientes" className={`sidebar-link ${isActive("/pacientes") ? "active" : ""}`} onClick={onClose}>
              <span className="icon">👥</span> Pacientes
            </Link>

            {['admin', 'superadmin', 'radiologo', 'transcriptor'].includes(user?.rol) && (
              <Link to="/plantillas" className={`sidebar-link ${isActive("/plantillas") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">📚</span> Gestor de Plantillas
              </Link>
            )}

            {isAdmin && (
              <Link to="/gestion-firmas" className={`sidebar-link ${isActive("/gestion-firmas") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">🔒</span> Gestión de Firmas
              </Link>
            )}

            {(isAdmin || isRecepcion) && (
              <Link to="/recepcion" className={`sidebar-link ${isActive("/recepcion") ? "active" : ""}`} onClick={onClose}>
                <span className="icon"><FaUserPlus /></span> Recepción / RIS
              </Link>
            )}

            {(isAdmin || isTecnologo) && (
              <Link to="/tecnologo" className={`sidebar-link ${isActive("/tecnologo") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">🖥️</span> Consola RIS
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

            {/* ADMINISTRACIÓN Y SUBMENÚ */}
            {(isAdmin || isAuxiliar) && (
              <div className="admin-section">
                <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                  <span className="icon">⚙️</span> Administración <span className="arrow">{openAdmin ? "▴" : "▾"}</span>
                </button>

                {openAdmin && (
                  <div className="sidebar-submenu">
                    {isSkalo && (<Link to="/gestion-usuarios" className={`submenu-link ${isActive("/gestion-usuarios") ? "active" : ""}`} style={{ color: '#818cf8', fontWeight: 'bold' }}><span className="icon"><FaUsersCog /></span> Gestión Usuarios</Link>)}
                    {isSkalo && (<Link to="/" className={`submenu-link ${location.pathname === "/" ? "active" : ""}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>⚙️ Configuración MI_PACS</Link>)}
                    {isSkalo && (<Link to="/gestion-backups" className={`submenu-link ${isActive("/gestion-backups") ? "active" : ""}`} style={{ color: '#34d399', fontWeight: 'bold' }}>📦 Ciclo de Vida / Backups</Link>)}
                    {isSkalo && (<Link to="/recuperar-backups" className={`submenu-link ${isActive("/recuperar-backups") ? "active" : ""}`} style={{ color: '#facc15', fontWeight: 'bold' }}>🔍 Recuperar Backups</Link>)}
                    {isSkalo && (<Link to="/config-mapeo" className={`submenu-link ${isActive("/config-mapeo") ? "active" : ""}`} style={{ color: '#60a5fa', fontWeight: '500' }}>🏷️ Configurar Tags DICOM</Link>)}
                    
                    {isSkalo && (
                      <Link to="/facturacion-servicio" className={`submenu-link ${isActive("/facturacion-servicio") ? "active" : ""}`} style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                        📈 Facturación de Servicios
                      </Link>
                    )}
                    
                    {isAdmin && (
                      <>
                        <Link to="/auditoria" className={`submenu-link ${isActive("/auditoria") ? "active" : ""}`}>📊 Auditoría</Link>
                        <Link to="/email-logs" className={`submenu-link ${isActive("/email-logs") ? "active" : ""}`}>✉️ Logs Email</Link>
                        <Link to="/whatsapp-logs" className={`submenu-link ${isActive("/whatsapp-logs") ? "active" : ""}`}>📱 Logs WhatsApp</Link>
                      </>
                    )}
                    
                    {isSkalo && (<Link to="/perfil-institucion" className={`submenu-link ${isActive("/perfil-institucion") ? "active" : ""}`} style={{ color: '#38bdf8', fontWeight: 'bold' }}>🏥 Perfil de Institución</Link>)} 
                    {isAdmin && (<button className="submenu-link reset-link" onClick={handleLimpiezaClinica} style={{ color: '#ff4d4d', fontWeight: 'bold', textAlign: 'left', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', padding: '10px 12px' }}>🧹 Limpiar Datos Clínicos</button>)}
                  </div>
                )}
              </div>
            )}

          </nav>
        </div>

        {/* BOTÓN DE CIERRE DE SESIÓN AL PIE */}
        <div className="sidebar-footer">
          <Link to="/logout" className="sidebar-link logout-btn">
            <span className="icon">🚪</span> Cerrar Sesión
          </Link>
        </div>

      </aside>
    </>
  );
}