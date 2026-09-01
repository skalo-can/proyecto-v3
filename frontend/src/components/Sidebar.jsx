import React, { useState, useEffect } from "react"; 
import { Link, useLocation } from "react-router-dom"; 
import { useAuth } from "../AuthContext.jsx"; 
import { FaUserPlus, FaUsersCog } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import "./Sidebar.css";

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

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
    if (!isAdmin) return alert(t('alertas_limpieza.acceso_denegado'));
    
    const primerFiltro = window.prompt(t('alertas_limpieza.prompt_advertencia'));
    if (primerFiltro !== t('alertas_limpieza.palabra_clave')) {
      if (primerFiltro !== null) alert(t('alertas_limpieza.palabra_incorrecta'));
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

    const tokenIngresado = window.prompt(t('alertas_limpieza.prompt_token'));

    if (tokenIngresado !== tokenMaestro) {
      alert(t('alertas_limpieza.token_invalido'));
      return;
    }

    try {
      const response = await fetch("http://192.168.5.21:8000/api/reset/soft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user?.token}` }
      });
      const data = await response.json();
      if (data.success) { alert("✅ " + data.message); window.location.href = "/pacientes"; } 
      else { alert("❌ Error: " + data.message); }
    } catch (error) {
      alert(t('alertas_limpieza.error_conexion'));
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
              <span className="icon">👥</span> {t('sidebar.pacientes')}
            </Link>

            {['admin', 'superadmin', 'radiologo', 'transcriptor'].includes(user?.rol) && (
              <Link to="/plantillas" className={`sidebar-link ${isActive("/plantillas") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">📚</span> {t('sidebar.plantillas')}
              </Link>
            )}

            {isAdmin && (
              <Link to="/gestion-firmas" className={`sidebar-link ${isActive("/gestion-firmas") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">🔒</span> {t('sidebar.firmas')}
              </Link>
            )}

            {(isAdmin || isRecepcion) && (
              <Link to="/recepcion" className={`sidebar-link ${isActive("/recepcion") ? "active" : ""}`} onClick={onClose}>
                <span className="icon"><FaUserPlus/></span> {t('sidebar.recepcion')}
              </Link>
            )}

            {(isAdmin || isTecnologo) && (
              <Link to="/tecnologo" className={`sidebar-link ${isActive("/tecnologo") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">🖥️</span> {t('sidebar.consola_ris')}
              </Link>
            )}          

            {(isAdmin || isInvitado) && (
              <Link to="/estadisticas" className={`sidebar-link ${isActive("/estadisticas") ? "active" : ""}`} onClick={onClose}>
                <span className="icon">📊</span> {t('sidebar.estadisticas')}
              </Link>
            )}

            {isAdmin && (
              <>
                <Link to="/importar" className={`sidebar-link ${isActive("/importar") ? "active" : ""}`} onClick={onClose}>
                  <span className="icon">💿</span> {t('sidebar.importar_cd')}
                </Link>
                <Link to="/exportar" className={`sidebar-link ${isActive("/exportar") ? "active" : ""}`} onClick={onClose}>
                  <span className="icon">📦</span> {t('sidebar.exportar')}
                </Link>
              </>
            )}          

            <div className="sidebar-divider"></div>

            {/* ADMINISTRACIÓN Y SUBMENÚ */}
            {(isAdmin || isAuxiliar) && (
              <div className="admin-section">
                <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                  <span className="icon">⚙️</span> {t('sidebar.administracion')} <span className="arrow">{openAdmin ? "▴" : "▾"}</span>
                </button>

                {openAdmin && (
                  <div className="sidebar-submenu">
                    {isSkalo && (<Link to="/gestion-usuarios" className={`submenu-link ${isActive("/gestion-usuarios") ? "active" : ""}`} style={{ color: '#818cf8', fontWeight: 'bold' }}><span className="icon"><FaUsersCog /></span> {t('sidebar.gestion_usuarios')}</Link>)}
                    {isSkalo && (<Link to="/" className={`submenu-link ${location.pathname === "/" ? "active" : ""}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>⚙️ {t('sidebar.configuracion')}</Link>)}
                    {isSkalo && (<Link to="/gestion-backups" className={`submenu-link ${isActive("/gestion-backups") ? "active" : ""}`} style={{ color: '#34d399', fontWeight: 'bold' }}>📦 {t('sidebar.ciclo_vida')}</Link>)}
                    {isSkalo && (<Link to="/recuperar-backups" className={`submenu-link ${isActive("/recuperar-backups") ? "active" : ""}`} style={{ color: '#facc15', fontWeight: 'bold' }}>🔍 {t('sidebar.recuperar_backups')}</Link>)}
                    {isSkalo && (<Link to="/config-mapeo" className={`submenu-link ${isActive("/config-mapeo") ? "active" : ""}`} style={{ color: '#60a5fa', fontWeight: '500' }}>🏷️ {t('sidebar.tags_dicom')}</Link>)}
                    
                    {isSkalo && (
                      <Link to="/facturacion-servicio" className={`submenu-link ${isActive("/facturacion-servicio") ? "active" : ""}`} style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                        📈 {t('sidebar.facturacion')}
                      </Link>
                    )}
                    
                    {isAdmin && (
                      <>
                        <Link to="/auditoria" className={`submenu-link ${isActive("/auditoria") ? "active" : ""}`}>📊 {t('sidebar.auditoria')}</Link>
                        <Link to="/email-logs" className={`submenu-link ${isActive("/email-logs") ? "active" : ""}`}>✉️ {t('sidebar.logs_email')}</Link>
                        <Link to="/whatsapp-logs" className={`submenu-link ${isActive("/whatsapp-logs") ? "active" : ""}`}>📱 {t('sidebar.logs_whatsapp')}</Link>
                      </>
                    )}
                    
                    {isSkalo && (<Link to="/perfil-institucion" className={`submenu-link ${isActive("/perfil-institucion") ? "active" : ""}`} style={{ color: '#38bdf8', fontWeight: 'bold' }}>🏥 {t('sidebar.perfil_institucion')}</Link>)} 
                    {isAdmin && (<button className="submenu-link reset-link" onClick={handleLimpiezaClinica} style={{ color: '#ff4d4d', fontWeight: 'bold', textAlign: 'left', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', padding: '10px 12px' }}>🧹 {t('sidebar.limpiar_datos')}</button>)}
                  </div>
                )}                
              </div>
            )}

          </nav>
        </div>

        {/* BOTÓN DE CIERRE DE SESIÓN AL PIE */}
        <div className="sidebar-footer">
          <Link to="/logout" className="sidebar-link logout-btn">
            <span className="icon">🚪</span> {t('sidebar.cerrar_sesion')}
          </Link>
        </div>

      </aside>
    </>
  );
}