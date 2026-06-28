/**
 * Header.jsx — MI_PACS (Versión corregida y balanceada con React)
 */

import React, { useState, useRef, useEffect } from "react"; // 👈 ¡Inyectamos React formalmente aquí!
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export const Header = ({ onOpenDicom, onResetDB }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const menuRef = useRef(null);

  // --- LÓGICA DE PERMISOS FLEXIBLE ---
  // Superusuario (Skalo / Admin unificado post-reset)
  const isSkalo = user && (user.rol === "superadmin" || user.rol === "admin");
  
  // Usuarios permitidos para ver Configuración (Admin y Superadmin)
  const canSeeConfig = user && (user.rol === "superadmin" || user.rol === "admin");

  // Función unificada para abrir la configuración
  const handleOpenConfig = () => {
    if (canSeeConfig) {
      onOpenDicom?.(); 
      setMenuOpen(false); 
    }
  };

  // Cerrar menú al hacer clic fuera
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
      {/* SECCIÓN IZQUIERDA: Solo es clickeable si tiene permisos de configuración */}
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
              
              {/* 🔐 Filtro de seguridad para Configuración */}
              {canSeeConfig && (
                <button className="dropdown-item" onClick={handleOpenConfig}>
                  Configuración
                </button>
              )}

              {/* Filtro de seguridad para Resetear Sistema (Solo Skalo) */}
              {isSkalo && onResetDB && (
                <button 
                  className="dropdown-item" 
                  style={{ color: '#ff4d4d' }}
                  onClick={() => { onResetDB(); setMenuOpen(false); }}
                >
                  ⚠️ Resetear Sistema
                </button>
              )}

              {/* Divisor visual: Solo si el usuario vio opciones de admin antes */}
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