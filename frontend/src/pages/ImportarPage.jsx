import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ImportarPage.css';

export default function ImportarPage() {
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
            const res = await axios.get('http://localhost:8000/api/importacion-fisica/estado', {
                headers: { 
                    'Authorization': `Bearer ${tokenLimpio}`,
                    'Accept': 'application/json'
                }
            });

            const data = res.data || {};
            setProgreso(data);

            if (data.finalizado === true) {
                clearInterval(intervaloProgreso.current);
                setLoading(false);
                setResumenFinal({ exitosos: data.exitosos, fallidos: data.fallidos });
            }
        } catch (err) {
            console.error("Error al rastrear la ingesta:", err);
        }
    };

    useEffect(() => {
        return () => { if (intervaloProgreso.current) clearInterval(intervaloProgreso.current); };
    }, []);

    const handleImportarHardwareLocal = async () => {
        const tokenLimpio = obtenerTokenLimpio();
        
        if (!tokenLimpio) {
            alert("🔒 Sesión Inválida. Por favor, inicia sesión de nuevo.");
            return;
        }

        setLoading(true);
        setResumenFinal(null);
        
        try {
            // Estructura de Axios corregida: post(url, body, config)
            const res = await axios.post('http://localhost:8000/api/importacion-fisica/disco-externo', {}, {
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
                alert("ℹ️ Operación cancelada por el operador clínico.");
            }
        } catch (err) {
            setLoading(false);
            const errorMsg = err.response?.data?.detail || "Error en la inyección de hardware local del servidor.";
            alert(`⚠️ CORTE DE CONEXIÓN: ${errorMsg}`);
        }
    };

    return (
        <div className="importar-page-wrapper">
            {resumenFinal && (
                <div className="modal-overlay-persistencia">
                    <div className="modal-caja-exito">
                        <div className="modal-icono">✅</div>
                        <h2>INGESTA FINALIZADA ESPECTACULARMENTE</h2>
                        <p>El motor ha terminado de procesar los archivos en el disco duro local.</p>
                        <div className="modal-estadisticas">
                            <div className="stat-item exitoso">
                                <span className="stat-valor">{resumenFinal.exitosos}</span>
                                <span className="stat-label">Guardados BD</span>
                            </div>
                            <div className="stat-item fallido">
                                <span className="stat-valor">{resumenFinal.fallidos}</span>
                                <span className="stat-label">Omitidos</span>
                            </div>
                        </div>
                        <button className="btn-entendido" onClick={() => setResumenFinal(null)}>OK, ENTENDIDO</button>
                    </div>
                </div>
            )}

            <header className="config-header">
                <h1 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>💿 MÓDULO DE INGESTA CLÍNICA AUTOMÁTICA</h1>
                <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Procesamiento local de Imágenes Médicas directamente en el Hardware del Servidor</p>
            </header>

            <main className="config-main" style={{ marginTop: '20px' }}>
                <section className="config-card" style={{ backgroundColor: '#111', border: '1px solid #222', padding: '25px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ fontSize: '2.5rem' }}>🎛️</span>
                        <div>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>Importación Directa (Lector de CD / Unidades USB)</h2>
                            <p style={{ color: '#777', margin: 0, fontSize: '0.85rem' }}>Python leerá y desempaquetará recursivamente los archivos DICOM a velocidad de hardware local sin saturar la red.</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '25px' }}>
                        <button 
                            className={`btn-importar-nucleo ${loading || progreso.en_progreso ? 'deshabilitado' : ''}`}
                            onClick={handleImportarHardwareLocal}
                            disabled={loading || progreso.en_progreso}
                            style={{ backgroundColor: loading || progreso.en_progreso ? '#333' : '#fbbf24', color: '#000', fontWeight: 'bold', border: 'none', padding: '14px 28px', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
                        >
                            {progreso.en_progreso ? "⏳ EXTRACCIÓN EN SEGUNDO PLANO ACTIVA..." : "🔌 SELECCIONAR UNIDAD FISICA EN SERVIDOR"}
                        </button>
                    </div>

                    {progreso.en_progreso && (
                        <div style={{ marginTop: '30px', backgroundColor: 'rgba(251, 191, 36, 0.03)', border: '1px solid #fbbf24', padding: '20px', borderRadius: '8px' }}>
                            <h3 style={{ color: '#fbbf24', margin: '0 0 15px 0', fontSize: '1rem' }}>📊 MONITOR DE INGESTA ACTIVO (NÚCLEO ASÍNCRONO)</h3>
                            <div style={{ display: 'flex', gap: '30px', color: '#fff', fontSize: '0.9rem' }}>
                                <div>📁 Detectados: <strong style={{ color: '#fbbf24' }}>{progreso.total_detectados}</strong></div>
                                <div>✅ Guardados BD: <strong style={{ color: '#10b981' }}>{progreso.exitosos}</strong></div>
                                <div>⚠️ Omitidos: <strong style={{ color: '#ef4444' }}>{progreso.fallidos}</strong></div>
                            </div>
                            <div style={{ backgroundColor: '#222', height: '10px', borderRadius: '5px', marginTop: '15px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: '#10b981', height: '100%', width: `${progreso.total_detectados > 0 ? (progreso.exitosos / progreso.total_detectados) * 100 : 0}%`, transition: 'width 0.3s ease' }}></div>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}