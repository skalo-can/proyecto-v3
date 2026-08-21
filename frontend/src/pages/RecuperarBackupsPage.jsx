import React, { useState } from 'react';
import { FaSearch, FaFolderOpen, FaServer } from 'react-icons/fa';
import './RecuperarBackupsPage.css'; // 👈 Aquí importamos el diseño visual

const RecuperarBackupsPage = () => {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");

  const buscarEnNAS = async (e) => {
    e.preventDefault();
    if (busqueda.length < 2) return;

    setCargando(true);
    setError(null);
    try {
      // ✅ CÓDIGO CORREGIDO: Usando el Enrutador Dinámico
      const response = await fetch(`${window.API_URL}/api/backup/buscar-en-nas?q=${encodeURIComponent(busqueda)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Error al conectar con el NAS");
      }
      
      const data = await response.json();
      setResultados(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const abrirCarpeta = async (ruta) => {
    try {
      // ✅ CÓDIGO CORREGIDO: Usando el Enrutador Dinámico
      const res = await fetch(`${window.API_URL}/api/backup/abrir-ubicacion`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ruta })
      });
      if (!res.ok) throw new Error("No se pudo abrir la carpeta");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="recuperar-backups-container">
      
      <div className="header-section">
        <h1><FaSearch /> Explorador y Recuperación NAS</h1>
        <p>Busque estudios archivados físicamente en los discos de red (H:) por nombre o identificación.</p>
      </div>

      {error && (
        <div className="error-msg">
          {error}
        </div>
      )}

      {/* BARRA DE BÚSQUEDA */}
      <div className="search-panel">
        <form onSubmit={buscarEnNAS} className="search-form">
          <div className="input-group">
            <label>Buscar Paciente (Nombre o ID)</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej: Jose Helmer o 17709056..."
            />
          </div>
          <button type="submit" className="btn-buscar" disabled={cargando || busqueda.length < 2}>
            {cargando ? "Buscando..." : <><FaSearch /> Buscar</>}
          </button>
        </form>
      </div>

      {/* TABLA DE RESULTADOS */}
      {resultados.length > 0 ? (
        <div className="resultados-panel">
          <table className="tabla-resultados">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>ID</th>
                <th>Modalidad</th>
                <th>Fecha Backup</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((res, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: '500', color: 'white' }}>{res.nombre_paciente}</td>
                  <td>{res.identificacion}</td>
                  <td>
                    <span className="badge-mod">{res.modalidad}</span>
                  </td>
                  <td>{res.fecha_backup}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => abrirCarpeta(res.ruta)}
                      title="Abrir carpeta en Windows"
                      className="btn-abrir"
                    >
                      <FaFolderOpen /> Abrir Ubicación
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !cargando && busqueda && (
          <div className="no-results">
            <FaServer size={40} style={{ opacity: 0.3, marginBottom: '15px' }} />
            <p>No se encontraron carpetas que coincidan con "{busqueda}" en el NAS.</p>
          </div>
        )
      )}
    </div>
  );
};

export default RecuperarBackupsPage;