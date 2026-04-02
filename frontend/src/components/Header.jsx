import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

export const Header = ({
  handleDicomImport,
  handleDicomExport,
  onOpenDicom,
  onDicomFilesSelected,
  onToggleSidebar // Aseguramos que esta prop se reciba si se usa
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // 🔹 Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="header">
      
      {/* SECCIÓN IZQUIERDA: Logo Dorado y Grande */}
      <div className="header-left">
        {/* Si tienes un botón de hamburguesa para el sidebar, iría aquí */}
        {/* <button onClick={onToggleSidebar} className="sidebar-toggle">☰</button> */}
        <div className="header-title">MI_PACS</div>
      </div>

      {/* SECCIÓN DERECHA: Menú de Opciones */}
      <div className="header-right" ref={menuRef}>
        <div className="menu-container">
          <button
            className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Opciones ▾
          </button>

          {menuOpen && (
            <div className="menu-dropdown fade-in">
              
              <button className="dropdown-item" onClick={() => {
                handleDicomImport && handleDicomImport();
                setMenuOpen(false);
              }}>
                Importar
              </button>

              <button className="dropdown-item" onClick={() => {
                handleDicomExport && handleDicomExport();
                setMenuOpen(false);
              }}>
                Exportar
              </button>

              <button className="dropdown-item" onClick={() => {
                onOpenDicom && onOpenDicom();
                setMenuOpen(false);
              }}>
                Configuración
              </button>

              {/* Línea divisoria visual */}
              <div className="dropdown-divider"></div>

              <Link to="/logout" className="dropdown-item logout-item" onClick={() => setMenuOpen(false)}>
                Cerrar sesión
              </Link>

            </div>
          )}
        </div>
      </div>

      {/* INPUT OCULTO PARA CARGA DE ARCHIVOS */}
      <input
        id="dicomInput"
        type="file"
        multiple
        webkitdirectory="true"
        directory="true"
        accept=".dcm"
        style={{ display: "none" }}
        onChange={onDicomFilesSelected}
      />

    </header>
  );
};