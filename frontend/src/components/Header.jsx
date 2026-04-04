import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export const Header = ({ onOpenDicom, onResetDB }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const menuRef = useRef(null);

  // Verificación segura: si no hay usuario, isSkalo es falso
  const isSkalo = user && user.rol === "superadmin";

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title">MI_PACS</div>
      </div>

      <div className="header-right" ref={menuRef}>
        <div className="menu-container">
          <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            Opciones ▾
          </button>

          {menuOpen && (
            <div className="menu-dropdown fade-in">
              <button className="dropdown-item" onClick={() => { onOpenDicom?.(); setMenuOpen(false); }}>
                Configuración
              </button>

              {/* Solo aparece si es superadmin (SKALO) */}
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