import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export const Header = ({ onOpenDicom, onResetDB }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const menuRef = useRef(null);

  const isSkalo = user && (user.rol === "superadmin" || user.rol === "admin");
  const canSeeConfig = user && (user.rol === "superadmin" || user.rol === "admin");

  const handleOpenConfig = () => {
    if (canSeeConfig) {
      onOpenDicom?.(); 
      setMenuOpen(false); 
    }
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
      <div 
        className={`header-left ${canSeeConfig ? 'clickable-title' : ''}`} 
        onClick={canSeeConfig ? handleOpenConfig : undefined} 
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
              {canSeeConfig && (
                <button className="dropdown-item" onClick={handleOpenConfig}>
                  Configuración
                </button>
              )}

              {isSkalo && onResetDB && (
                <button 
                  className="dropdown-item" 
                  style={{ color: '#ff4d4d' }}
                  onClick={() => { onResetDB(); setMenuOpen(false); }}
                >
                  ⚠️ Resetear Sistema
                </button>
              )}

              {canSeeConfig && <div className="dropdown-divider"></div>}

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

export default Header;