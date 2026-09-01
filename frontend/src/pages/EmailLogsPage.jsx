import { useEffect, useState } from "react";
import { listarEmailLogs } from "../services/emailLogsService";
import { useTranslation } from "react-i18next";
import "./EmailLogsPage.css";

export default function EmailLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await listarEmailLogs();
        setLogs(Array.isArray(data) ? data : (data.items || []));
      } catch (err) {
        console.error(err);
        setError(t('email_logs.error_cargar'));
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [t]);

  return (
    <div className="email-container">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h1 className="email-title" style={{ marginBottom: '5px' }}>
            {t('email_logs.titulo')}
          </h1>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 12px', borderRadius: '15px', border: '1px solid #fbbf24', fontSize: '10px', fontWeight: '800', display: 'inline-block' }}>
            {t('email_logs.subtitulo')}
          </div>
        </div>
        <button className="volver-btn" onClick={() => window.history.back()} style={{ margin: 0 }}>
          {t('email_logs.btn_volver')}
        </button>
      </div>

      <div className="email-card">
        
        {loading ? (
          <div style={{ textAlign: 'center', color: '#fbbf24', marginTop: '40px', fontWeight: 'bold' }}>
            {t('email_logs.cargando')}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#ef4444', marginTop: '40px' }}>
            <p>⚠️ {error}</p>
            <button onClick={() => window.location.reload()} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>
              {t('email_logs.btn_reintentar')}
            </button>
          </div>
        ) : (
          <table className="email-table">
            <thead>
              <tr>
                <th>{t('email_logs.th_id_estudio')}</th>
                <th>{t('email_logs.th_paciente')}</th>
                <th>{t('email_logs.th_correo_destino')}</th>
                <th>{t('email_logs.th_formato')}</th>
                <th>{t('email_logs.th_estado')}</th>
                <th>{t('email_logs.th_fecha_hora')}</th>
              </tr>
            </thead>

            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "#64748b", fontWeight: "bold" }}>
                    {t('email_logs.sin_registros')}
                  </td>
                </tr>
              ) : (
                logs.map((item) => {
                  const isSuccess = String(item.estado).toLowerCase() === 'enviado';
                  
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>LOG #{item.id}</div>
                        <div style={{ fontSize: '10px', color: '#fbbf24' }}>ESTUDIO: {item.estudio_id}</div>
                      </td>
                      <td style={{ fontWeight: "bold", color: "#fff" }}>
                        {item.paciente_nombre || t('email_logs.sin_nombre')}
                      </td>
                      <td style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                        {item.email}
                      </td>
                      <td>{item.formato}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: isSuccess ? '#10b981' : '#ef4444'
                        }}>
                          {String(item.estado).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {item.fecha ? new Date(item.fecha).toLocaleString() : t('email_logs.na')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}