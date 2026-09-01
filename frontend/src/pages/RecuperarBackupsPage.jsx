import React, { useState } from 'react';
import { FaSearch, FaFolderOpen, FaServer } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import './RecuperarBackupsPage.css'; // 👈 Aquí importamos el diseño visual

const RecuperarBackupsPage = () => {
  const { t } = useTranslation();
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
        throw new Error(err.detail || t('recuperar_backups.error_conectar_nas'));
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
      if (!res.ok) throw new Error(t('recuperar_backups.error_abrir_carpeta'));
    } catch (err) {
      alert(t('recuperar_backups.error_prefijo') + err.message);
    }
  };

  return (
    <div className="recuperar-backups-container">
      
      <div className="header-section">
        <h1><FaSearch /> {t('recuperar_backups.titulo')}</h1>
        <p>{t('recuperar_backups.subtitulo')}</p>
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
            <label>{t('recuperar_backups.lbl_buscar_paciente')}</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t('recuperar_backups.placeholder_buscar')}
            />
          </div>
          <button type="submit" className="btn-buscar" disabled={cargando || busqueda.length < 2}>
            {cargando ? t('recuperar_backups.buscando') : <><FaSearch /> {t('recuperar_backups.btn_buscar')}</>}
          </button>
        </form>
      </div>

      {/* TABLA DE RESULTADOS */}
      {resultados.length > 0 ? (
        <div className="resultados-panel">
          <table className="tabla-resultados">
            <thead>
              <tr>
                <th>{t('recuperar_backups.th_paciente')}</th>
                <th>{t('recuperar_backups.th_id')}</th>
                <th>{t('recuperar_backups.th_modalidad')}</th>
                <th>{t('recuperar_backups.th_fecha_backup')}</th>
                <th style={{ textAlign: 'center' }}>{t('recuperar_backups.th_accion')}</th>
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
                      title={t('recuperar_backups.title_abrir_carpeta')}
                      className="btn-abrir"
                    >
                      <FaFolderOpen /> {t('recuperar_backups.btn_abrir_ubicacion')}
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
            <p>{t('recuperar_backups.sin_resultados_1')}{busqueda}{t('recuperar_backups.sin_resultados_2')}</p>
          </div>
        )
      )}
    </div>
  );
};

export default RecuperarBackupsPage;