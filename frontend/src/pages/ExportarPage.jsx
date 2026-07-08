import React, { useState } from 'react';
import axios from 'axios';
import './ExportarPage.css';

export default function ExportarPage() {
    const [criterio, setCriterio] = useState('');
    const [estudios, setEstudios] = useState([]);
    const [seleccionados, setSeleccionados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [procesando, setProcesando] = useState(false);
    
    // 🔥 CONTROLES DE EXPORTACIÓN
    const [incluirVisor, setIncluirVisor] = useState(true);
    const [modoDestino, setModoDestino] = useState('EXPLORADOR'); // 'CD_DVD' o 'EXPLORADOR'

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
        
        try {
            const tokenLimpio = obtenerTokenLimpio();
            const res = await axios.get(`http://localhost:8000/api/pacientes?busqueda=${criterio}`, {
                headers: { Authorization: `Bearer ${tokenLimpio}` }
            });

            const pacientesData = Array.isArray(res.data) ? res.data : (res.data.items || []);
            let todosLosEstudios = [];
            
            pacientesData.forEach(paciente => {
                if (paciente.estudios && paciente.estudios.length > 0) {
                    paciente.estudios.forEach(est => {
                        todosLosEstudios.push({
                            ...est,
                            nombrePaciente: `${paciente.primer_nombre} ${paciente.primer_apellido}`,
                            cedula: paciente.identificacion,
                            tienePdf: est.estado === "firmado" || est.estado_pacs === "firmado" || paciente.estado_pacs === "Firmado"
                        });
                    });
                } else {
                    todosLosEstudios.push({
                        ...paciente,
                        nombrePaciente: `${paciente.primer_nombre} ${paciente.primer_apellido}` || "Paciente Encontrado",
                        cedula: paciente.identificacion,
                        tienePdf: paciente.estado_pacs === "Firmado" || paciente.estado === "firmado"
                    });
                }
            });

            setEstudios(todosLosEstudios);
            
            if (todosLosEstudios.length === 0) {
                alert("ℹ️ No se encontraron estudios asociados a esta identificación.");
            }

        } catch (err) {
            console.error("Error en búsqueda:", err);
            alert("❌ Error al conectar con la base de datos PACS.");
        } finally {
            setBuscando(false);
        }
    };

    const toggleSeleccionarTodo = (e) => {
        if (e.target.checked) {
            setSeleccionados(estudios.map((est, idx) => est.id || est.accession_number || idx));
        } else {
            setSeleccionados([]);
        }
    };

    const toggleSeleccionarUno = (id) => {
        setSeleccionados(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleExportarHardwareLocal = async () => {
        if (seleccionados.length === 0) {
            alert("⚠️ Debe seleccionar al menos un estudio de la tabla para exportar.");
            return;
        }

        setProcesando(true);
        try {
            const tokenLimpio = obtenerTokenLimpio();
            
            // 🚀 ENVIAMOS EL MODO AL BACKEND (CD/DVD o EXPLORADOR)
            const res = await axios.post('http://localhost:8000/api/pacientes/exportar/medios-externos', {
                estudios_ids: seleccionados,
                incluir_visor: incluirVisor,
                modo_destino: modoDestino
            }, {
                headers: { 
                    'Authorization': `Bearer ${tokenLimpio}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (res.data.status === "success") {
                alert(`📦 EXPORTACIÓN COMPLETA CON ÉXITO:\n\n${res.data.message}`);
                setSeleccionados([]); 
            } else {
                alert(`⚠️ Ocurrió un problema: ${res.data.message}`);
            }

        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.detail || "Error en la comunicación con el hardware de exportación.";
            alert(`❌ SISTEMA: ${errorMsg}`);
        } finally {
            setProcesando(false);
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
                                value={criterio} 
                                onChange={e => setCriterio(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleBuscarPaciente()}
                                style={{ width: '100%', padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '1rem' }}
                            />
                        </div>
                        <button 
                            onClick={handleBuscarPaciente}
                            disabled={buscando}
                            style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', height: '43px' }}
                        >
                            {buscando ? "Buscando..." : "🔍 BUSCAR PACIENTE"}
                        </button>
                    </div>

                    {estudios.length > 0 && (
                        <div className="tabla-resultados-exportacion" style={{ window: '100%', marginBottom: '25px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.9rem', textAlign: 'left' }}>
                                <thead style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
                                    <tr>
                                        <th style={{ padding: '12px 15px', width: '50px' }}>
                                            <input 
                                                type="checkbox" 
                                                onChange={toggleSeleccionarTodo}
                                                checked={seleccionados.length === estudios.length && estudios.length > 0}
                                                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                            />
                                        </th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>PACIENTE</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>FECHA ESTUDIO</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>MODALIDAD</th>
                                        <th style={{ padding: '12px 15px', color: '#fbbf24' }}>ESTUDIO / PROCEDIMIENTO</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>DOCUMENTOS ADJUNTOS</th>
                                        <th style={{ padding: '12px 15px', color: '#94a3b8' }}>ESTADO PACS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estudios.map((est, index) => {
                                        const uniqueId = est.id || est.accession_number || index;
                                        return (
                                            <tr key={uniqueId} style={{ borderBottom: '1px solid #1e293b', backgroundColor: seleccionados.includes(uniqueId) ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                                                <td style={{ padding: '12px 15px' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={seleccionados.includes(uniqueId)}
                                                        onChange={() => toggleSeleccionarUno(uniqueId)}
                                                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{est.nombrePaciente}</td>
                                                <td style={{ padding: '12px 15px' }}>{est.fecha_estudio || est.fecha || "2020-04-04"}</td>
                                                <td style={{ padding: '12px 15px' }}>
                                                    <span style={{ backgroundColor: '#1e3a8a', color: '#60a5fa', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        {est.modalidad || "DX"}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 15px', color: '#f8fafc', fontWeight: '500', fontSize: '0.85rem' }}>
                                                    {est.descripcion || est.study_description || est.procedimiento || "Sin descripción DICOM"}
                                                </td>
                                                <td style={{ padding: '12px 15px' }}>
                                                    {est.tienePdf ? (
                                                        <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            📄 Reporte PDF
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                                            ⚠️ Sin informe
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 15px', color: '#cbd5e1' }}>
                                                    {est.estado_pacs || est.estado || "Ingresado"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* 🔥 PANEL DE CONFIGURACIÓN EXCLUYENTE */}
                    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '25px' }}>
                        
                        <label style={{ color: '#fbbf24', fontSize: '0.9rem', display: 'block', marginBottom: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            🎯 ¿CÓMO DESEA EXPORTAR LOS ESTUDIOS?
                        </label>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                            {/* Opción 1: Explorador */}
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

                            {/* Opción 2: CD/DVD */}
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

                        {/* Visor Lite (Siempre disponible) */}
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

                    {/* BOTÓN DE ACCIÓN COLECTOR */}
                    <button 
                        className="btn-exportar-nucleo"
                        onClick={handleExportarHardwareLocal}
                        disabled={procesando || seleccionados.length === 0}
                        style={{ 
                            backgroundColor: (procesando || seleccionados.length === 0) ? '#333' : '#10b981', 
                            color: (procesando || seleccionados.length === 0) ? '#666' : '#000', 
                            fontWeight: 'bold', border: 'none', padding: '14px 28px', borderRadius: '6px', 
                            cursor: (procesando || seleccionados.length === 0) ? 'not-allowed' : 'pointer',
                            fontSize: '1.05rem', transition: 'all 0.3s', display: 'block', width: '100%'
                        }}
                    >
                        {procesando ? "⏳ ESPERANDO AL MOTOR FÍSICO..." : `💾 INICIAR EXPORTACIÓN DE ESTUDIOS (${seleccionados.length})`}
                    </button>
                </section>
            </main>
        </div>
    );
}