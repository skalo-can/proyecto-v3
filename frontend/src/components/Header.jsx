import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export const Header = ({ onOpenDicom, onResetDB }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const menuRef = useRef(null);

  const isSkalo = user && user.rol === "superadmin";

  // Función unificada para abrir la configuración con datos cargados
  const handleOpenConfig = () => {
    onOpenDicom?.(); // Ejecuta la misma lógica que el botón del menú
    setMenuOpen(false); // Cierra el menú si estaba abierto
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="header">
      {/* SECCIÓN IZQUIERDA: Ahora usa la función handleOpenConfig para cargar todo */}
      <div 
        className="header-left clickable-title" 
        onClick={handleOpenConfig} 
      >
        <div className="header-title">MI_PACS</div>
      </div>

      <div className="header-right" ref={menuRef}>
        <div className="menu-container">
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            Opciones ▾
          </button>

          {menuOpen && (
            <div className="menu-dropdown fade-in">
              {/* Usamos la misma función aquí también */}
              <button className="dropdown-item" onClick={handleOpenConfig}>
                Configuración
              </button>

              {isSkalo && onResetDB && (
                <button 
                  className="dropdown-item" 
                  style={{ color: '#ff4d4d' }}
                  onClick={() => { onResetDB(); setMenuOpen(false); }}
                >
                  ⚠️ Resetear Sistema
                </button>
              )}

              <div className="dropdown-divider"></div>
              <Link to="/logout" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                Cerrar sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};