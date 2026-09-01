import { useEffect, useState } from "react";
import { listarWhatsAppLogs } from "../services/whatsappService";
import { useTranslation } from "react-i18next";
import "./WhatsAppLogsPage.css"; 

export default function WhatsAppLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [telefono, setTelefono] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  async function cargarLogs(opts = {}) {
    try {
      setLoading(true);
      setError(null);
      const data = await listarWhatsAppLogs({
        telefono,
        fechaDesde,
        fechaHasta,
        page,
        pageSize,
        ...opts,
      });
      setLogs(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error(err);
      setError(t('whatsapp_logs.error_cargar'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setPage(1);
    cargarLogs({ page: 1 });
  };

  const handleLimpiar = () => {
    setTelefono("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    cargarLogs({ telefono: "", fechaDesde: "", fechaHasta: "", page: 1 });
  };

  return (
    <div className="productividad-container" style={{ height: 'calc(100vh - 70px)', padding: '20px', background: '#0b0e11', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      <div className="prod-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div>
          <h2 style={{ color: '#fbbf24', margin: 0 }}>{t('whatsapp_logs.titulo')}</h2>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 12px', borderRadius: '15px', border: '1px solid #fbbf24', fontSize: '10px', fontWeight: '800', marginTop: '5px', display: 'inline-block' }}>
            {t('whatsapp_logs.subtitulo')}
          </div>
        </div>
        <button className="btn-secondary" onClick={() => window.history.back()} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {t('whatsapp_logs.btn_volver')}
        </button>
      </div>

      <form onSubmit={handleBuscar} className="filtros-audit-bar glass-box" style={{ background: '#111418', border: '1px solid #333', borderRadius: '12px', display: 'flex', gap: '20px', padding: '15px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'bold' }}>{t('whatsapp_logs.lbl_telefono')}</label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder={t('whatsapp_logs.ph_telefono')}
            style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '5px', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 'bold' }}>{t('whatsapp_logs.lbl_rango_fechas')}</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="datetime-local"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '5px', fontSize: '13px', outline: 'none' }}
            />
            <input
              type="datetime-local"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '5px', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('whatsapp_logs.btn_buscar')}
          </button>
          <button type="button" onClick={handleLimpiar} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t('whatsapp_logs.btn_limpiar')}
          </button>
        </div>
      </form>

      <div className="table-audit-wrapper glass-box" style={{ background: '#111418', border: '1px solid #333', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        
        <style>{`
            .golden-scroll { flex: 1; overflow-y: auto !important; min-height: 0 !important; padding-right: 8px; }
            .golden-scroll::-webkit-scrollbar { width: 14px !important; display: block !important; }
            .golden-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4) !important; border-radius: 8px !important; }
            .golden-scroll::-webkit-scrollbar-thumb { background-color: #fbbf24 !important; border-radius: 8px !important; border: 3px solid #111418 !important; }
            .golden-scroll::-webkit-scrollbar-thumb:hover { background-color: #f59e0b !important; }
        `}</style>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#fbbf24', marginTop: '40px', fontWeight: 'bold' }}>
            {t('whatsapp_logs.cargando')}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#ef4444', marginTop: '40px' }}>
            <p>⚠️ {error}</p>
            <button onClick={() => cargarLogs()} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>{t('whatsapp_logs.btn_reintentar')}</button>
          </div>
        ) : (
          <div className="golden-scroll">
            <table className="tabla-audit" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#1a1d26', zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                <tr>
                  <th style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{t('whatsapp_logs.th_id_estudio')}</th>
                  <th style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{t('whatsapp_logs.th_telefono')}</th>
                  <th style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{t('whatsapp_logs.th_mensaje')}</th>
                  <th style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{t('whatsapp_logs.th_estado')}</th>
                  <th style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>{t('whatsapp_logs.th_fecha')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontWeight: 'bold' }}>
                      {t('whatsapp_logs.sin_registros')}
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => {
                    const isSuccess = String(item.estado).toLowerCase() === 'enviado';
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px' }}>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>{t('whatsapp_logs.log')} #{item.id}</div>
                          <div style={{ fontSize: '10px', color: '#fbbf24' }}>{t('whatsapp_logs.estudio')}: {item.estudio_id}</div>
                        </td>
                        <td style={{ color: '#38bdf8', padding: '10px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {item.telefono}
                        </td>
                        <td style={{ color: '#cbd5e1', padding: '10px', fontSize: '0.85rem' }}>
                          <div style={{ whiteSpace: 'pre-wrap', maxHeight: '50px', overflowY: 'auto' }}>
                            {item.mensaje}
                          </div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                            backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: isSuccess ? '#10b981' : '#ef4444'
                          }}>
                            {String(item.estado).toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: '#94a3b8', padding: '10px', fontSize: '0.85rem' }}>
                          {item.creado_en ? new Date(item.creado_en).toLocaleString() : t('whatsapp_logs.na')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ background: page === 1 ? '#1e293b' : '#38bdf8', color: page === 1 ? '#64748b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {t('whatsapp_logs.btn_anterior')}
            </button>
            <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '0.9rem' }}>{t('whatsapp_logs.pagina')} {page}</span>
            <button
              disabled={logs.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
              style={{ background: logs.length < pageSize ? '#1e293b' : '#38bdf8', color: logs.length < pageSize ? '#64748b' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: logs.length < pageSize ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {t('whatsapp_logs.btn_siguiente')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}