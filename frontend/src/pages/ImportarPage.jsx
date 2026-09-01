import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import './ImportarPage.css';

export default function ImportarPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [progreso, setProgreso] = useState({
        en_progreso: false,
        exitosos: 0,
        fallidos: 0,
        total_detectados: 0,
        finalizado: false
    });
    const [resumenFinal, setResumenFinal] = useState(null);
    const intervaloProgreso = useRef(null);

    // Función para extraer y limpiar el token de autenticación
    const obtenerTokenLimpio = () => {
        let tokenCrudo = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
        return tokenCrudo.replace(/['"]+/g, '').trim();
    };

    const verificarEstadoImportacion = async () => {
        try {
            const tokenLimpio = obtenerTokenLimpio();
            // ✅ CORREGIDO 1/6
            const res = await axios.get(`${window.API_URL}/api/importacion-fisica/estado`, {
                headers: { 
                    'Authorization': `Bearer ${tokenLimpio}`,
                    'Accept': 'application/json'
                }
            });

            const data = res.data || {};

            if (data.finalizado === true) {
                // 🚀 Matamos el intervalo inmediatamente y purgamos la memoria
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
        let componenteMontado = true; // 🚀 Bandera anti-fantasmas

        const reconectarProgreso = async () => {
            try {
                const tokenLimpio = obtenerTokenLimpio();
                // ✅ CORREGIDO 2/6
                const res = await axios.get(`${window.API_URL}/api/importacion-fisica/estado`, {
                    headers: { 'Authorization': `Bearer ${tokenLimpio}`, 'Accept': 'application/json' }
                });
                
                // Solo activamos el temporizador si el usuario no ha cerrado la pestaña
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
            componenteMontado = false; // 🚀 Si el usuario huye de la pestaña, abortamos arranques futuros
            if (intervaloProgreso.current) clearInterval(intervaloProgreso.current); 
        };
    }, []);

    // 🚀 Limpieza profunda al cerrar la ventana de éxito
    const handleCerrarModal = () => {
        setResumenFinal(null);
        setProgreso({
            en_progreso: false,
            exitosos: 0,
            fallidos: 0,
            total_detectados: 0,
            finalizado: false
        });
    };

    const handleImportarHardwareLocal = async () => {
        const tokenLimpio = obtenerTokenLimpio();
        
        if (!tokenLimpio) {
            alert(t('importacion.sesion_invalida'));
            return;
        }

        setLoading(true);
        setResumenFinal(null);
        
        try {
            // ✅ CORREGIDO 3/6
            const res = await axios.post(`${window.API_URL}/api/importacion-fisica/disco-externo`, {}, {
                headers: { 
                    'Authorization': `Bearer ${tokenLimpio}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.data.status === "success") {
                setProgreso({ 
                    en_progreso: true, 
                    exitosos: 0, 
                    fallidos: 0, 
                    total_detectados: res.data.archivos_detectados || 0, 
                    finalizado: false 
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

    // 🚀 CAMBIO 2: Función para cancelar la ingesta
    const handleCancelarImportacion = async () => {
        const confirmar = window.confirm(t('importacion.confirmar_cancelar'));
        if (!confirmar) return;

        try {
            const tokenLimpio = obtenerTokenLimpio();
            // ✅ CORREGIDO 4/6
            await axios.post(`${window.API_URL}/api/importacion-fisica/cancelar`, {}, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}` }
            });
            alert(t('importacion.orden_cancelacion_enviada'));
        } catch (err) {
            alert(t('importacion.error_cancelar_motor'));
        }
    };

    // 🚀 CAMBIO 3: Funciones para Base de Datos
    const handleExportarBD = async () => {
        try {
            const tokenLimpio = obtenerTokenLimpio();
            // ✅ CORREGIDO 5/6
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
            // ✅ CORREGIDO 6/6
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
                        <button className="btn-entendido" onClick={handleCerrarModal}>{t('importacion.ok_entendido')}</button>
                    </div>
                </div>
            )}

            <header className="config-header">
                <h1 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{t('importacion.titulo_modulo')}</h1>
                <p style={{ color: '#aaa', fontSize: '0.85rem' }}>{t('importacion.subtitulo_modulo')}</p>
            </header>

            <main className="config-main" style={{ marginTop: '20px' }}>
                {/* SECCIÓN 1: IMPORTACIÓN DE IMÁGENES */}
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
                            onClick={handleImportarHardwareLocal}
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
                                {/* 🚀 BOTÓN DE CANCELAR AÑADIDO AQUÍ */}
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

                {/* 🚀 NUEVA SECCIÓN 2: GESTIÓN DE BASE DE DATOS */}
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
                        
                        {/* 🚀 BOTÓN RECONVERTIDO PARA MIGRACIÓN EN CALIENTE POR RED */}
                        <button 
                            onClick={handleImportarHardwareLocal}
                            disabled={loading || progreso.en_progreso}
                            style={{ 
                                backgroundColor: loading || progreso.en_progreso ? '#333' : '#8b5cf6', 
                                color: '#fff', 
                                fontWeight: 'bold', 
                                border: 'none', 
                                padding: '12px 24px', 
                                borderRadius: '6px', 
                                cursor: loading || progreso.en_progreso ? 'not-allowed' : 'pointer', 
                                fontSize: '1rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px' 
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