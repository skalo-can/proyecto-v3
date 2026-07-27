import React, { useState } from 'react';
import axios from 'axios';
import './ExportarPage.css';

export default function ExportarPage() {
    const [criterio, setCriterio] = useState('');
    const [estudios, setEstudios] = useState([]);
    const [seleccionados, setSeleccionados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    
    // 🔥 ESTADOS PARA BARRA DE PROGRESO
    const [estadoExportacion, setEstadoExportacion] = useState('inactiva'); 
    const [progreso, setProgreso] = useState(0);
    const [mensajeProgreso, setMensajeProgreso] = useState('');
    
    // 🔥 CONTROLES DE EXPORTACIÓN (Restaurados y 100% visibles)
    const [incluirVisor, setIncluirVisor] = useState(true);
    const [modoDestino, setModoDestino] = useState('EXPLORADOR');

    const obtenerTokenLimpio = () => {
        let tokenCrudo = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
        return tokenCrudo.replace(/['"]+/g, '').trim();
    };

    const handleBuscarPaciente = async () => {
        if (!criterio.trim()) {
            alert("⚠️ Ingrese una cédula o identificación para buscar.");
            return;
        }

        setBuscando(true);
        setEstudios([]); 
        setSeleccionados([]); 
        setEstadoExportacion('inactiva');
        setProgreso(0);
        
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.get(`http://localhost:8000/api/pacientes?busqueda=${criterio}`, {
                headers: { Authorization: `Bearer ${tokenLimpio}` }
            });

            const pacientesData = Array.isArray(res.data) ? res.data : (res.data.items || []);
            let todosLosEstudios = [];
            
            pacientesData.forEach((item, idx) => {
                if (item.estudios && item.estudios.length > 0) {
                    item.estudios.forEach((est, estIdx) => {
                        todosLosEstudios.push({
                            ...est,
                            estudio_real_id: est.id,
                            estudio_unico_id: est.estudio_interno_id || est.accession_number || `nested_${idx}_${estIdx}`,
                            nombrePaciente: `${item.primer_nombre} ${item.primer_apellido}`,
                            cedula: item.identificacion,
                            // 🚀 FIX: Leemos tipo_estudio de la base de datos real
                            modalidad_real: est.tipo_estudio || est.modalidad || "DX",
                            tienePdf: est.estado === "firmado" || est.estado_pacs === "firmado" || item.estado_pacs === "Firmado"
                        });
                    });
                } else {
                    todosLosEstudios.push({
                        ...item,
                        estudio_real_id: item.estudio_interno_id || item.id,
                        estudio_unico_id: item.estudio_interno_id || item.accession_number || `flat_${idx}`,
                        nombrePaciente: `${item.primer_nombre} ${item.primer_apellido}` || "Paciente Encontrado",
                        cedula: item.identificacion,
                        // 🚀 FIX: Leemos tipo_estudio de la base de datos real
                        modalidad_real: item.tipo_estudio || item.modalidad || "DX",
                        tienePdf: item.estado_pacs === "Firmado" || item.estado === "firmado"
                    });
                }
            });

            setEstudios(todosLosEstudios);
            if (todosLosEstudios.length === 0) alert("ℹ️ No se encontraron estudios asociados a esta identificación.");
        } catch (err) {
            console.error("Error en búsqueda:", err);
            alert("❌ Error al conectar con la base de datos PACS.");
        } finally {
            setBuscando(false);
        }
    };

    const toggleSeleccionarTodo = (e) => {
        if (e.target.checked) setSeleccionados(estudios.map(est => est.estudio_unico_id));
        else setSeleccionados([]);
    };

    const toggleSeleccionarUno = (id) => {
        setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleCancelarExportacion = () => {
        setEstadoExportacion('error');
        setMensajeProgreso('Exportación cancelada por el usuario.');
        setProgreso(0);
    };

    const handleExportarHardwareLocal = async () => {
        if (seleccionados.length === 0) return alert("⚠️ Debe seleccionar al menos un estudio.");

        setEstadoExportacion('procesando');
        setProgreso(10);
        setMensajeProgreso("Iniciando aislamiento de estudios seleccionados...");

        try {
            const tokenLimpio = obtenerTokenLimpio();
            setTimeout(() => { if (estadoExportacion === 'procesando') setProgreso(40); setMensajeProgreso("Copiando y empaquetando DICOMs..."); }, 1500);
            
            const estudiosAExportar = estudios.filter(est => seleccionados.includes(est.estudio_unico_id));

            const res = await axios.post('http://localhost:8000/api/pacientes/exportar/medios-externos', {
                estudios_ids: estudiosAExportar.map(e => e.estudio_real_id),
                incluir_visor: incluirVisor,
                modo_destino: modoDestino
            }, {
                headers: { 'Authorization': `Bearer ${tokenLimpio}`, 'Content-Type': 'application/json' }
            });
            
            if (res.data.status === "success") {
                setProgreso(100);
                setMensajeProgreso("¡Exportación completada!");
                setEstadoExportacion('completada');
                setTimeout(() => {
                    alert(`📦 EXPORTACIÓN COMPLETA:\n\n${res.data.message}`);
                    setSeleccionados([]); 
                    setEstadoExportacion('inactiva');
                }, 500);
            } else {
                setEstadoExportacion('error');
                setMensajeProgreso("Ocurrió un error.");
                alert(`⚠️ Problema: ${res.data.message}`);
            }
        } catch (err) {
            console.error(err);
            setEstadoExportacion('error');
            setMensajeProgreso("Fallo en la transferencia.");
            alert(`❌ SISTEMA: ${err.response?.data?.detail || "Error interno."}`);
        }
    };

    return (
        <div className="exportar-page-wrapper">
            <header className="config-header">
                <h1 style={{ color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>📦 MÓDULO DE EXPORTACIÓN Y QUEMADO DICOM</h1>
                <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Extracción de Estudios Médicos con Estructuras nativas para entrega de discos a pacientes</p>
            </header>

            <main className="config-main" style={{ marginTop: '20px' }}>
                <section className="config-card" style={{ backgroundColor: '#111', border: '1px solid #222', padding: '25px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                        <span style={{ fontSize: '2.5rem' }}>💾</span>
                        <div>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>Escribir Estudios a Medios Externos</h2>
                            <p style={{ color: '#777', margin: 0, fontSize: '0.85rem' }}>Agrupa las imágenes DICOM de la base de datos local y genera un paquete clínico listo para diagnóstico externo.</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '30px' }}>
                        <div className="form-group-export" style={{ width: '300px' }}>
                            <label style={{ color: '#fbbf24', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>IDENTIFICACIÓN / CÉDULA DEL PACIENTE</label>
                            <input 
                                placeholder="Ej. 1110486325" 
                                value={criterio} onChange={e => setCriterio(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleBuscarPaciente()}
                                disabled={estadoExportacion === 'procesando'}
                                style={{ width: '100%', padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                            />
                        </div>
                        <button 
                            onClick={handleBuscarPaciente} disabled={buscando || estadoExportacion === 'procesando'}
                            style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            {buscando ? "Buscando..." : "🔍 BUSCAR PACIENTE"}
                        </button>
                    </div>

                    {estudios.length > 0 && (
                        <div className="tabla-resultados-exportacion" style={{ width: '100%', marginBottom: '25px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.9rem', textAlign: 'left' }}>
                                <thead style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
                                    <tr>
                                        <th style={{ padding: '12px 15px', width: '50px' }}>
                                            <input type="checkbox" onChange={toggleSeleccionarTodo} checked={seleccionados.length === estudios.length && estudios.length > 0} disabled={estadoExportacion === 'procesando'} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                        </th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>PACIENTE</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>FECHA</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>MODALIDAD</th>
                                        <th style={{ padding: '12px 15px', color: '#fbbf24' }}>ESTUDIO / PROCEDIMIENTO</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>DOCUMENTOS ADJUNTOS</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>ESTADO PACS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudios.map((est) => {
                                        const isSelected = seleccionados.includes(est.estudio_unico_id);
                                        const modReal = est.modalidad_real;
                                        return (
                                            <tr key={est.estudio_unico_id} style={{ borderBottom: '1px solid #1e293b', backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                                                <td style={{ padding: '12px 15px' }}>
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleSeleccionarUno(est.estudio_unico_id)} disabled={estadoExportacion === 'procesando'} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                                </td>
                                                <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{est.nombrePaciente}</td>
                                                <td style={{ padding: '12px 15px' }}>{est.fecha_estudio || est.fecha || "2020-04-04"}</td>
                                                <td style={{ padding: '12px 15px' }}>
                                                    <span style={{ 
                                                        backgroundColor: modReal === 'CT' ? '#064e3b' : modReal === 'CR' ? '#701a75' : '#1e3a8a', 
                                                        color: modReal === 'CT' ? '#34d399' : modReal === 'CR' ? '#f0abfc' : '#60a5fa', 
                                                        padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' 
                                                    }}>
                                                        {modReal}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 15px', color: '#f8fafc', fontWeight: '500' }}>
                                                    {est.descripcion || est.study_description || est.procedimiento || "Sin descripción DICOM"}
                                                </td>
                                                <td style={{ padding: '12px 15px' }}>
                                                    {est.tienePdf ? (
                                                        <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>📄 Reporte PDF</span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>⚠️ Sin informe</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 15px', color: '#cbd5e1' }}>{est.estado_pacs || est.estado || "Ingresado"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* 🔥 PANEL DE CONFIGURACIÓN EXCLUYENTE (Restaurado y 100% visible) */}
                    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '25px', opacity: estadoExportacion === 'procesando' ? 0.5 : 1, pointerEvents: estadoExportacion === 'procesando' ? 'none' : 'auto' }}>
                        
                        <label style={{ color: '#fbbf24', fontSize: '0.9rem', display: 'block', marginBottom: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            🎯 ¿CÓMO DESEA EXPORTAR LOS ESTUDIOS?
                        </label>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                            <div 
                                onClick={() => setModoDestino('EXPLORADOR')}
                                style={{ flex: 1, padding: '15px', borderRadius: '8px', border: modoDestino === 'EXPLORADOR' ? '2px solid #2563eb' : '1px solid #444', backgroundColor: modoDestino === 'EXPLORADOR' ? 'rgba(37, 99, 235, 0.1)' : '#0f172a', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="radio" checked={modoDestino === 'EXPLORADOR'} readOnly style={{ transform: 'scale(1.2)' }} />
                                    <strong style={{ color: '#fff', fontSize: '1rem' }}>🗂️ Explorador de Windows</strong>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '8px 0 0 25px' }}>Se abrirá una ventana para que usted elija manualmente la ruta, USB o disco duro donde guardar.</p>
                            </div>

                            <div 
                                onClick={() => setModoDestino('CD_DVD')}
                                style={{ flex: 1, padding: '15px', borderRadius: '8px', border: modoDestino === 'CD_DVD' ? '2px solid #10b981' : '1px solid #444', backgroundColor: modoDestino === 'CD_DVD' ? 'rgba(16, 185, 129, 0.1)' : '#0f172a', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="radio" checked={modoDestino === 'CD_DVD'} readOnly style={{ transform: 'scale(1.2)' }} />
                                    <strong style={{ color: '#fff', fontSize: '1rem' }}>💿 Quemador CD / DVD Directo</strong>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '8px 0 0 25px' }}>El sistema buscará automáticamente la unidad de CD/DVD insertada y grabará el contenido.</p>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>
                                <input 
                                    type="checkbox" 
                                    checked={incluirVisor} 
                                    onChange={(e) => setIncluirVisor(e.target.checked)}
                                    style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                                />
                                Incluir Software "MI_PACS Lite" (Visor Portable)
                            </label>
                            <p style={{ color: '#94a3b8', margin: '5px 0 0 28px', fontSize: '0.85rem' }}>
                                Graba un ejecutable ligero para que el médico remitente no necesite instalar programas externos.
                            </p>
                        </div>
                    </div>

                    {/* 🔥 INTERFAZ DE BARRA DE PROGRESO */}
                    {estadoExportacion !== 'inactiva' && (
                        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#fff', fontWeight: 'bold' }}>
                                <span>{mensajeProgreso}</span>
                                <span style={{ color: estadoExportacion === 'error' ? '#ef4444' : '#10b981' }}>{progreso}%</span>
                            </div>
                            <div style={{ width: '100%', backgroundColor: '#0f172a', borderRadius: '4px', height: '12px', overflow: 'hidden', marginBottom: '15px' }}>
                                <div style={{ height: '100%', width: `${progreso}%`, backgroundColor: estadoExportacion === 'error' ? '#ef4444' : '#10b981', transition: 'width 0.4s ease-out' }} />
                            </div>
                            {estadoExportacion === 'procesando' && (
                                <button onClick={handleCancelarExportacion} style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    ❌ Cancelar Operación
                                </button>
                            )}
                        </div>
                    )}

                    {estadoExportacion === 'inactiva' && (
                        <button 
                            onClick={handleExportarHardwareLocal} disabled={seleccionados.length === 0}
                            style={{ backgroundColor: seleccionados.length === 0 ? '#333' : '#10b981', color: seleccionados.length === 0 ? '#666' : '#000', fontWeight: 'bold', border: 'none', padding: '14px 28px', borderRadius: '6px', cursor: seleccionados.length === 0 ? 'not-allowed' : 'pointer', fontSize: '1.05rem', display: 'block', width: '100%' }}
                        >
                            💾 INICIAR EXPORTACIÓN DE ESTUDIOS ({seleccionados.length})
                        </button>
                    )}
                </section>
            </main>
        </div>
    );
}