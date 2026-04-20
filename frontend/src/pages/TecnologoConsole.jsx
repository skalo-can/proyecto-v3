import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Header from '../components/Header'; 
import './TecnologoConsole.css';

const TecnologoConsole = () => {
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWorklist = useCallback(async () => {
        try {
            const response = await axios.get(`http://localhost:8000/api/ris/worklist?t=${Date.now()}`);
            setPacientes(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Error al cargar:", err);
        }
    }, []);

    useEffect(() => {
        fetchWorklist();
        const interval = setInterval(fetchWorklist, 5000);
        return () => clearInterval(interval);
    }, [fetchWorklist]);

    const handleAtender = async (id) => {
        try {
            await axios.put(`http://localhost:8000/api/ris/order/atender/${id}`, { usuario_id: 1 });
            setPacientes(prev => prev.filter(p => p.id_orden !== id));
        } catch (err) {
            alert("Error al procesar la atención.");
        }
    };

    return (
        <div className="tecnologo-container">
            <Header />
            <main className="tecnologo-main">
                <div className="tecnologo-header-bar">
                    <h1>CONSOLA TÉCNICA</h1>
                    <div style={{color: '#94a3b8', fontSize: '0.9rem'}}>
                        Modo: <strong style={{color: '#38bdf8'}}>Maestro</strong> | 
                        Modalidad: <strong style={{color: '#38bdf8'}}>DR</strong>
                    </div>
                </div>

                <div className="pacientes-grid">
                    {pacientes.map((p) => (
                        <div key={p.id_orden} className="paciente-card">
                            <div className="card-header">
                                <span className="card-tag-modality">{p.modalidad || 'DR'}</span>
                                <span className="card-tag-priority">{p.prioridad || 'Urgente'}</span>
                            </div>
                            <div className="card-body">
                                <h3 className="card-name">{p.apellido}, {p.nombre}</h3>
                                <div className="card-details">
                                    <p>ID: <strong>{p.id_institucional}</strong></p>
                                    <p>Acc: <strong>{p.accession_number}</strong></p>
                                    <p style={{fontStyle: 'italic', marginTop: '10px'}}>{p.estudio_descripcion || 'Radiografía'}</p>
                                </div>
                            </div>
                            <button className="btn-marcar-atendido" onClick={() => handleAtender(p.id_orden)}>
                                MARCAR ATENDIDO
                            </button>
                        </div>
                    ))}
                </div>

                {!loading && pacientes.length === 0 && (
                    <div style={{textAlign: 'center', color: '#64748b', marginTop: '100px'}}>
                        ✅ No hay pacientes pendientes.
                    </div>
                )}
            </main>
        </div>
    );
};

export default TecnologoConsole;