import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import './ImportarPage.css';

export default function ImportarPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [progreso, setProgreso] = useState({
        en_progreso: false, exitosos: 0, fallidos: 0,
        total_detectados: 0, finalizado: false
    });
    const [resumenFinal, setResumenFinal] = useState(null);
    
    // 🚀 NUEVOS ESTADOS PARA EL MODAL VISUAL
    const [mostrarModalRuta, setMostrarModalRuta] = useState(false);
    const [rutaInput, setRutaInput] = useState("");
    
    const intervaloProgreso = useRef(null);

    const obtenerTokenLimpio = () => {
        let tokenCrudo = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
        return tokenCrudo.replace(/['"]+/g, '').trim();
    };

    const verificarEstadoImportacion = async () => {
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.get(`${window.API_URL}/api/importacion-fisica/estado`, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}`, 'Accept': 'application/json' }
            });

            const data = res.data || {};

            if (data.finalizado === true) {
                if (intervaloProgreso.current) {
                    clearInterval(intervaloProgreso.current);
                    intervaloProgreso.current = null; 
                }
                setLoading(false);
                setProgreso(data);
                setResumenFinal({ exitosos: data.exitosos, fallidos: data.fallidos });
            } else {
                setProgreso(data);
            }
        } catch (err) {
            console.error("Error al rastrear la ingesta:", err);
        }
    };

    useEffect(() => {
        let componenteMontado = true;

        const reconectarProgreso = async () => {
            try {
                const tokenLimpio = obtenerTokenLimpio();
                const res = await axios.get(`${window.API_URL}/api/importacion-fisica/estado`, {
                    headers: { 'Authorization': `Bearer ${tokenLimpio}`, 'Accept': 'application/json' }
                });
                
                if (componenteMontado && res.data && res.data.en_progreso && !res.data.finalizado) {
                    if (intervaloProgreso.current) clearInterval(intervaloProgreso.current);
                    setProgreso(res.data);
                    setLoading(true);
                    intervaloProgreso.current = setInterval(verificarEstadoImportacion, 1500);
                }
            } catch (err) {
                console.error("No se pudo reconectar al estado del motor:", err);
            }
        };

        reconectarProgreso();

        return () => { 
            componenteMontado = false; 
            if (intervaloProgreso.current) clearInterval(intervaloProgreso.current); 
        };
    }, []);

    const handleCerrarModalExito = () => {
        setResumenFinal(null);
        setProgreso({ en_progreso: false, exitosos: 0, fallidos: 0, total_detectados: 0, finalizado: false });
    };

    // 🚀 ABRE EL MODAL VISUAL EN LUGAR DEL WINDOW.PROMPT
    const abrirModalRuta = () => {
        const tokenLimpio = obtenerTokenLimpio();
        if (!tokenLimpio) {
            alert(t('importacion.sesion_invalida'));
            return;
        }
        setRutaInput("");
        setMostrarModalRuta(true);
    };

    // 🚀 EJECUTA LA IMPORTACIÓN CUANDO EL USUARIO CONFIRMA EN EL MODAL
    const confirmarImportacion = async () => {
        if (!rutaInput || rutaInput.trim() === '') {
            alert(t('importacion.ruta_requerida'));
            return;
        }

        setMostrarModalRuta(false);
        setLoading(true);
        setResumenFinal(null);
        
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.post(`${window.API_URL}/api/importacion-fisica/disco-externo`, 
            { ruta: rutaInput.trim() }, 
            {
                headers: { 
                    'Authorization': `Bearer ${tokenLimpio}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.data.status === "success") {
                setProgreso({ 
                    en_progreso: true, exitosos: 0, fallidos: 0, 
                    total_detectados: res.data.archivos_detectados || 0, finalizado: false 
                });
                intervaloProgreso.current = setInterval(verificarEstadoImportacion, 1500);
            } else if (res.data.status === "cancelled") {
                setLoading(false);
                alert(t('importacion.operacion_cancelada'));
            }
        } catch (err) {
            setLoading(false);
            const errorMsg = err.response?.data?.detail || t('importacion.error_inyeccion');
            alert(`${t('importacion.corte_conexion')}${errorMsg}`);
        }
    };

    const handleCancelarImportacion = async () => {
        const confirmar = window.confirm(t('importacion.confirmar_cancelar'));
        if (!confirmar) return;

        try {
            const tokenLimpio = obtenerTokenLimpio();
            await axios.post(`${window.API_URL}/api/importacion-fisica/cancelar`, {}, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}` }
            });
            alert(t('importacion.orden_cancelacion_enviada'));
        } catch (err) {
            alert(t('importacion.error_cancelar_motor'));
        }
    };

    const handleExportarBD = async () => {
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.post(`${window.API_URL}/api/importacion-fisica/exportar-bd`, {}, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}` }
            });
            alert(`${t('importacion.bd_exportada_exito')}${res.data.message || t('importacion.operacion_completada')}`);
        } catch (err) {
            alert(`${t('importacion.error_exportar_bd')}${err.response?.data?.detail || t('importacion.fallo_servidor')}`);
        }
    };

    const handleImportarBD = async () => {
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.post(`${window.API_URL}/api/importacion-fisica/importar-bd`, {}, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}` }
            });
            alert(`${t('importacion.bd_importada_exito')}${res.data.message || t('importacion.operacion_completada')}`);
        } catch (err) {
            alert(`${t('importacion.error_importar_bd')}${err.response?.data?.detail || t('importacion.fallo_servidor')}`);
        }
    };

    return (
        <div className="importar-page-wrapper">
            
            {/* 🚀 MODAL VISUAL PARA LA RUTA */}
            {mostrarModalRuta && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#1a1d26', border: '1px solid #fbbf24', borderRadius: '10px', padding: '25px', width: '90%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>📁</span> Ingesta Clínica Local
                        </h3>
                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '15px', whiteSpace: 'pre-line' }}>
                            {t('importacion.prompt_ruta')}
                        </p>
                        <input 
                            type="text" 
                            value={rutaInput}
                            onChange={(e) => setRutaInput(e.target.value)}
                            placeholder="D:\ o /mnt/usb"
                            style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #4a5066', backgroundColor: '#0f1114', color: '#fff', fontSize: '1rem', boxSizing: 'border-box', outline: 'none', marginBottom: '20px', fontFamily: 'monospace' }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setMostrarModalRuta(false)} style={{ padding: '10px 20px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Cancelar
                            </button>
                            <button onClick={confirmarImportacion} style={{ padding: '10px 20px', backgroundColor: '#fbbf24', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Iniciar Extracción
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {resumenFinal && (
                <div className="modal-overlay-persistencia">
                    <div className="modal-caja-exito">
                        <div className="modal-icono">✅</div>
                        <h2>{t('importacion.ingesta_finalizada')}</h2>
                        <p>{t('importacion.motor_terminado')}</p>
                        <div className="modal-estadisticas">
                            <div className="stat-item exitoso">
                                <span className="stat-valor">{resumenFinal.exitosos}</span>
                                <span className="stat-label">{t('importacion.guardados_bd')}</span>
                            </div>
                            <div className="stat-item fallido">
                                <span className="stat-valor">{resumenFinal.fallidos}</span>
                                <span className="stat-label">{t('importacion.omitidos')}</span>
                            </div>
                        </div>
                        <button className="btn-entendido" onClick={handleCerrarModalExito}>{t('importacion.ok_entendido')}</button>
                    </div>
                </div>
            )}

            <header className="config-header">
                <h1 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{t('importacion.titulo_modulo')}</h1>
                <p style={{ color: '#aaa', fontSize: '0.85rem' }}>{t('importacion.subtitulo_modulo')}</p>
            </header>

            <main className="config-main" style={{ marginTop: '20px' }}>
                <section className="config-card" style={{ backgroundColor: '#111', border: '1px solid #222', padding: '25px', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '2.5rem' }}>🎛️</span>
                        <div>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>{t('importacion.importacion_directa')}</h2>
                            <p style={{ color: '#777', margin: 0, fontSize: '0.85rem' }}>{t('importacion.desc_importacion')}</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '25px' }}>
                        <button 
                            className={`btn-importar-nucleo ${loading || progreso.en_progreso ? 'deshabilitado' : ''}`}
                            onClick={abrirModalRuta}
                            disabled={loading || progreso.en_progreso}
                            style={{ backgroundColor: loading || progreso.en_progreso ? '#333' : '#fbbf24', color: '#000', fontWeight: 'bold', border: 'none', padding: '14px 28px', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            {progreso.en_progreso ? t('importacion.extraccion_activa') : t('importacion.seleccionar_unidad')}
                        </button>
                    </div>

                    {progreso.en_progreso && (
                        <div style={{ marginTop: '30px', backgroundColor: 'rgba(251, 191, 36, 0.03)', border: '1px solid #fbbf24', padding: '20px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ color: '#fbbf24', margin: '0', fontSize: '1rem' }}>{t('importacion.monitor_ingesta')}</h3>
                                <button onClick={handleCancelarImportacion} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t('importacion.btn_cancelar_proceso')}</button>
                            </div>
                            <div style={{ display: 'flex', gap: '30px', color: '#fff', fontSize: '0.9rem' }}>
                                <div>{t('importacion.detectados')} <strong style={{ color: '#fbbf24' }}>{progreso.total_detectados}</strong></div>
                                <div>{t('importacion.guardados_bd_monitor')} <strong style={{ color: '#10b981' }}>{progreso.exitosos}</strong></div>
                                <div>{t('importacion.omitidos_monitor')} <strong style={{ color: '#ef4444' }}>{progreso.fallidos}</strong></div>
                            </div>
                            <div style={{ backgroundColor: '#222', height: '10px', borderRadius: '5px', marginTop: '15px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: '#10b981', height: '100%', width: `${progreso.total_detectados > 0 ? (progreso.exitosos / progreso.total_detectados) * 100 : 0}%`, transition: 'width 0.3s ease' }}></div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="config-card" style={{ backgroundColor: '#111', border: '1px solid #222', padding: '25px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                        <span style={{ fontSize: '2.5rem' }}>🗄️</span>
                        <div>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>{t('importacion.gestion_respaldo')}</h2>
                            <p style={{ color: '#777', margin: 0, fontSize: '0.85rem' }}>{t('importacion.desc_gestion')}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        <button 
                            onClick={handleExportarBD}
                            style={{ backgroundColor: '#3b82f6', color: '#fff', fontWeight: 'bold', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                            {t('importacion.btn_exportar')}
                        </button>
                        
                        <button 
                            onClick={handleImportarBD}
                            disabled={loading || progreso.en_progreso}
                            style={{ 
                                backgroundColor: loading || progreso.en_progreso ? '#333' : '#8b5cf6', 
                                color: '#fff', 
                                fontWeight: 'bold', border: 'none', padding: '12px 24px', borderRadius: '6px', 
                                cursor: loading || progreso.en_progreso ? 'not-allowed' : 'pointer', 
                                fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' 
                            }}
                        >
                            {t('importacion.btn_migracion')}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}