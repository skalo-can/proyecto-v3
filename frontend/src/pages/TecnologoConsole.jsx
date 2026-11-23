import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './TecnologoConsole.css';

const TecnologoConsole = () => {
    const { t, i18n } = useTranslation();
    const isEn = i18n.language?.startsWith('en');
    const apiBase = import.meta.env.VITE_API_URL || window.API_URL || '';

    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);

    const traducirPrioridad = (prioridad) => {
        if (!prioridad) return t('consola_ris.default_urgente');
        if (!isEn) return prioridad;
        const map = {
            rutina: 'Routine',
            urgente: 'Urgent',
            alta: 'High',
            normal: 'Normal',
            baja: 'Low'
        };
        return map[String(prioridad).toLowerCase().trim()] || prioridad;
    };

    const fetchWorklist = useCallback(async () => {
        try {
            const response = await axios.get(`${apiBase}/api/ris/worklist?t=${Date.now()}`);
            setPacientes(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Error al cargar:", err);
        }
    }, [apiBase]);

    useEffect(() => {
        fetchWorklist();
        const interval = setInterval(fetchWorklist, 5000);
        return () => clearInterval(interval);
    }, [fetchWorklist]);

    const handleAtender = async (id) => {
        try {
            await axios.put(`${apiBase}/api/ris/order/atender/${id}`, { usuario_id: 1 });
            setPacientes(prev => prev.filter(p => p.id_orden !== id));
        } catch (err) {
            alert(t('consola_ris.alerta_error'));
        }
    };

    return (
        <main className="tecnologo-main" style={{ padding: '20px', height: '100%' }}>
            <div className="tecnologo-header-bar">
                <h1>{t('consola_ris.titulo')}</h1>
            </div>

            <div className="pacientes-grid">
                {pacientes.map((p) => (
                    <div key={p.id_orden} className="paciente-card">
                        <div className="card-header">
                            <span className="card-tag-modality">{p.modalidad || 'DR'}</span>
                            <span className="card-tag-priority">{traducirPrioridad(p.prioridad)}</span>
                        </div>
                        <div className="card-body">
                            <h3 className="card-name">{p.apellido}, {p.nombre}</h3>
                            <div className="card-details">
                                <p>ID: <strong>{p.id_institucional}</strong></p>
                                <p>Acc: <strong>{p.accession_number}</strong></p>
                                <p style={{ fontStyle: 'italic', marginTop: '10px' }}>
                                    {p.estudio_descripcion || t('consola_ris.default_estudio')}
                                </p>
                            </div>
                        </div>
                        <button className="btn-marcar-atendido" onClick={() => handleAtender(p.id_orden)}>
                            {t('consola_ris.btn_atender')}
                        </button>
                    </div>
                ))}
            </div>

            {!loading && pacientes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: '100px' }}>
                    {t('consola_ris.sin_pacientes')}
                </div>
            )}
        </main>
    );
};

export default TecnologoConsole;