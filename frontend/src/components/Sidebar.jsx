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

  // 🛡️ BLINDAJE EXTREMO: Convertimos a String seguro para evitar que .toUpperCase() rompa React
  const userRol = String(user?.rol || "").toLowerCase().trim();
  const currentUsername = String(user?.username || user?.nombre || "").trim().toUpperCase();
  
  const isSkalo = currentUsername.includes("SKALO") || userRol === "superadmin";
  const isAdmin = userRol === "admin" || isSkalo;
  const isAuxiliar = userRol === "auxiliar";
  const isInvitado = userRol === "invitado";
  const isRecepcion = userRol === "recepcion";
  const isTecnologo = userRol === "tecnologo"; 

  // 🔥 DETECCIÓN DEL SÚPER PODER (Corregido leyendo el boolean del backend)
  const userRolRaw = String(user?.rol || "").toLowerCase().trim();
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
      
      {/* 🔥 CONTENEDOR PRINCIPAL: Flexbox vertical en toda la altura */}
      <aside className={`sidebar ${isOpen ? "open" : ""}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* 1. CABECERA FIJA */}
        <div className="sidebar-header">
          <span className="sidebar-subtitle">MI_PACS SYSTEM</span>
          <br />
          <small className={esUrgenciologo ? "urgencia-badge" : ""} style={{ color: esUrgenciologo ? '#ef4444' : '#fbbf24', fontWeight: 'bold' }}>
            {isSkalo ? "🚀 MODO MAESTRO" : esUrgenciologo ? "🚨 MÉD. URGENCIAS" : `🛡️ ${userRolRaw.toUpperCase()}`}
          </small>
        </div>

        {/* 2. ZONA NAVEGABLE CON SCROLL FLEXIBLE */}
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
          <Link to="/pacientes" className={`sidebar-link ${isActive("/pacientes") ? "active" : ""}`} onClick={onClose}>
            <span className="icon">👥</span> Pacientes
          </Link>
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
          {(isAdmin || isAuxiliar) && (
            <div className="sidebar-section">
              <button className="sidebar-link dropdown-toggle" onClick={() => setOpenAdmin(!openAdmin)}>
                <span className="icon">⚙️</span> Administración {openAdmin ? "▴" : "▾"}
              </button>
              {openAdmin && (
                <div className="sidebar-submenu" style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '5px' }}>
                  {/* 🔥 CORRECCIÓN: Altura máxima y scroll interno exclusivo para este submenú */}
                  
                  {isSkalo && (<Link to="/gestion-usuarios" className={`submenu-link ${isActive("/gestion-usuarios") ? "active" : ""}`} style={{ color: '#6366f1', fontWeight: 'bold' }}><span className="icon"><FaUsersCog /></span> Gestión Usuarios</Link>)}
                  {isSkalo && (<Link to="/" className={`submenu-link ${location.pathname === "/" ? "active" : ""}`} style={{ color: '#fbbf24', fontWeight: 'bold' }}>⚙️ Configuración MI_PACS</Link>)}
                  {isSkalo && (<Link to="/gestion-backups" className={`submenu-link ${isActive("/gestion-backups") ? "active" : ""}`} style={{ color: '#10b981', fontWeight: 'bold' }}>📦 Ciclo de Vida / Backups</Link>)}
                  {isSkalo && (<Link to="/config-mapeo" className={`submenu-link ${isActive("/config-mapeo") ? "active" : ""}`} style={{ color: '#1890ff', fontWeight: '500' }}>🏷️ Configurar Tags DICOM</Link>)}
                  <Link to="/reporte-cobros" className={`submenu-link ${isActive("/reporte-cobros") ? "active" : ""}`}>📈 Reporte Cobros / Glosas</Link>
                  {isAdmin && (
                    <>
                      <Link to="/auditoria" className={`submenu-link ${isActive("/auditoria") ? "active" : ""}`}>📊 Auditoría</Link>
                      <Link to="/email-logs" className={`submenu-link ${isActive("/email-logs") ? "active" : ""}`}>✉️ Logs Email</Link>
                      <Link to="/whatsapp-logs" className={`submenu-link ${isActive("/whatsapp-logs") ? "active" : ""}`}>📱 Logs WhatsApp</Link>
                    </>
                  )}
                  {isSkalo && (<Link to="/perfil-institucion" className={`submenu-link ${isActive("/perfil-institucion") ? "active" : ""}`} style={{ color: '#38bdf8', fontWeight: 'bold' }}>🏥 Perfil de Institución</Link>)} 
                  {isAdmin && (<button className="submenu-link reset-link" onClick={handleLimpiezaClinica} style={{ color: '#ff4d4d', fontWeight: 'bold', marginTop: '10px', textAlign: 'left', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer', padding: '8px 12px' }}>🧹 Limpiar Datos Clínicos</button>)}
                
                </div>
              )}

            </div>
          )}
        </nav>

{/* 3. BOTÓN DE SALIDA SIEMPRE VISIBLE AL FONDO */}
        {/* 🔥 CORRECCIÓN: Aumentamos el padding inferior a 40px (antes 15px) para subir el botón */}
        <div style={{ marginTop: 'auto', padding: '15px 15px 65px 15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: '#111827' }}>
          <Link to="/logout" className="sidebar-link logout-btn" style={{ color: '#ff4d4d', margin: '0' }}>
            <span className="icon">🚪</span> Cerrar Sesión
          </Link>
        </div>

      </aside>
    </>
  );
}