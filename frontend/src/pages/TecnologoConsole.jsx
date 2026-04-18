import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TecnologoConsole.css';

export default function TecnologoConsole() {
    const [pacientes, setPacientes] = useState([]);
    const [colaboradores, setColaboradores] = useState([]); 
    const [showModal, setShowModal] = useState(false);
    const [selectedEstudioId, setSelectedEstudioId] = useState(null);
    
    // Obtenemos el usuario de la sesión actual
    const user = JSON.parse(localStorage.getItem("user")) || { id: 1, nombre: "Soporte", rol: "admin" };

    const fetchDatos = async () => {
        try {
            // 1. Cargamos la lista de pacientes pendientes
            const resPacientes = await axios.get('http://localhost:8000/api/ris/worklist');
            setPacientes(resPacientes.data.filter(p => p.estado !== 'terminado'));
            
            // 2. Si eres Admin/Maestro, cargamos la lista de tecnólogos para el modal
            if (user.rol === "admin" || user.rol === "maestro") {
                const resUsers = await axios.get('http://localhost:8000/api/usuarios/tecnologos');
                setColaboradores(resUsers.data);
            }
        } catch (err) {
            console.error("Error al sincronizar datos:", err);
        }
    };

    const handleAtendidoClick = (p) => {
        // SEGURIDAD: Buscamos el ID del estudio en todas las variantes posibles del objeto
        const idEncontrado = p.id || p.id_estudio || p.estudio_id;

        if (!idEncontrado) {
            console.error("Objeto recibido sin ID:", p);
            alert("Error: El sistema no detecta el ID de este estudio.");
            return;
        }

        if (user.rol === "admin" || user.rol === "maestro") {
            // Si eres Admin, abrimos el modal para que elijas al tecnólogo
            setSelectedEstudioId(idEncontrado);
            setShowModal(true);
        } else {
            // Si eres tecnólogo, se te asigna a ti directamente
            ejecutarAtencion(idEncontrado, user.id);
        }
    };

    const ejecutarAtencion = async (estudioId, tecnologoId) => {
        try {
            await axios.patch(`http://localhost:8000/api/atender/${estudioId}`, {
                usuario_id: tecnologoId
            });
            setShowModal(false);
            fetchDatos(); // Refrescar lista
        } catch (err) {
            console.error("Error en PATCH:", err.response?.data);
            alert("No se pudo registrar la atención en el servidor.");
        }
    };

    useEffect(() => {
        fetchDatos();
        const interval = setInterval(fetchDatos, 10000); // Auto-refresco cada 10 seg
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="tablet-view">
            <header className="tablet-header">
                <h2>MI_PACS | CONSOLA TÉCNICA</h2>
                <div className="user-info">
                    Modo: <b>{user.rol === 'admin' ? 'Administrador' : 'Tecnólogo'}</b> | 
                    Usuario: <b>{user.nombre}</b>
                </div>
            </header>

            <div className="cards-grid">
                {pacientes.length === 0 ? (
                    <div className="no-data">No hay pacientes en espera de atención.</div>
                ) : (
                    pacientes.map((p, index) => (
                        <div key={p.id || index} className="tablet-card">
                            <div className="card-body">
                                <span className="mod-badge">{p.modalidad}</span>
                                <h3>{p.paciente_nombre || p.paciente}</h3>
                                <p><b>ID:</b> {p.paciente_id}</p>
                                <p><b>Acc:</b> {p.accession_number || p.acc_number}</p>
                                <div className={`prioridad-tag ${p.prioridad?.toLowerCase() || 'rutina'}`}>
                                    {p.prioridad || 'RUTINA'}
                                </div>
                            </div>
                            <button 
                                className="btn-confirmar" 
                                onClick={() => handleAtendidoClick(p)}
                            >
                                MARCAR ATENDIDO
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* MODAL DE SELECCIÓN EXCLUSIVO PARA ADMIN/MAESTRO */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-box">
                        <h3 style={{color: '#fbbf24', marginBottom: '10px'}}>Asignar Atención</h3>
                        <p style={{color: '#ccc', marginBottom: '20px'}}>¿Qué tecnólogo realizó este estudio?</p>
                        
                        <div className="tecnologos-list">
                            {colaboradores.length > 0 ? (
                                colaboradores.map(tec => (
                                    <button 
                                        key={tec.id} 
                                        className="btn-user-select" 
                                        onClick={() => ejecutarAtencion(selectedEstudioId, tec.id)}
                                    >
                                        {tec.nombre}
                                    </button>
                                ))
                            ) : (
                                <p style={{color: 'red'}}>No se encontraron tecnólogos en la base de datos.</p>
                            )}
                        </div>
                        
                        <button className="btn-cancelar" onClick={() => setShowModal(false)}>
                            CANCELAR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}