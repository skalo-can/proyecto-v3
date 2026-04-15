import React, { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import "./Productividad.css";

export default function Productividad() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ 
    rol: "TODOS", 
    profesional: "TODOS",
    fechaDesde: new Date().toISOString().split('T')[0], 
    fechaHasta: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchProductividad = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ 
            fecha_desde: filtros.fechaDesde, 
            fecha_hasta: filtros.fechaHasta, 
            rol: filtros.rol 
        });
        const res = await fetch(`http://localhost:8000/api/productividad-real?${params}`);
        const data = await res.json();
        setDatos(data);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    fetchProductividad();
  }, [filtros.fechaDesde, filtros.fechaHasta, filtros.rol]);

  // --- LÓGICA DE ANÁLISIS PARA GERENCIA ---

  // 1. Obtener lista única de nombres para el filtro individual
  const listaProfesionales = useMemo(() => {
    const nombres = [...new Set(datos.map(d => d.profesional))];
    return nombres.sort();
  }, [datos]);

  // 2. Ranking de rendimiento (Conteo por persona)
  const rankingRendimiento = useMemo(() => {
    const conteo = {};
    datos.forEach(d => {
      if (d.estado === "Terminado") {
        conteo[d.profesional] = (conteo[d.profesional] || 0) + 1;
      }
    });
    return Object.entries(conteo)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [datos]);

  const filtrados = filtros.profesional === "TODOS" 
    ? datos 
    : datos.filter(d => d.profesional === filtros.profesional);

  return (
    <div className="productividad-container">
      <div className="prod-header">
        <h2 style={{ color: '#fbbf24' }}>📊 Auditoría de Rendimiento Personal y Departamental</h2>
        <div className="gerencia-badge">EQUIPO: {listaProfesionales.length} PROFESIONALES ACTIVOS</div>
      </div>
      
      {/* BARRA DE FILTROS AVANZADA */}
      <div className="filtros-audit-bar glass-box">
        <div className="f-group">
            <label>FILTRAR DEPARTAMENTO</label>
            <select value={filtros.rol} onChange={(e) => setFiltros({...filtros, rol: e.target.value, profesional: "TODOS"})}>
                <option value="TODOS">Todo el Centro</option>
                <option value="MEDICO">Cuerpo Médico ({rankingRendimiento.filter(r => datos.find(d => d.profesional === r.name)?.rol === 'MEDICO').length})</option>
                <option value="TECNOLOGO">Staff Tecnólogos</option>
                <option value="TRANSCRIPTOR">Dpto. Transcripción</option>
            </select>
        </div>

        <div className="f-group">
            <label>ANALIZAR PROFESIONAL ESPECÍFICO</label>
            <select value={filtros.profesional} onChange={(e) => setFiltros({...filtros, profesional: e.target.value})}>
                <option value="TODOS">Ver todos los nombres</option>
                {listaProfesionales.map(nombre => (
                    <option key={nombre} value={nombre}>{nombre}</option>
                ))}
            </select>
        </div>

        <div className="f-group">
            <label>RANGO DE ANÁLISIS</label>
            <div style={{display:'flex', gap:'5px'}}>
                <input type="date" value={filtros.fechaDesde} onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})} />
                <input type="date" value={filtros.fechaHasta} onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})} />
            </div>
        </div>
      </div>

      <div className="dashboard-grid-gerencial">
        {/* COLUMNA IZQUIERDA: GRÁFICAS DE VIABILIDAD */}
        <div className="charts-column">
            <div className="chart-item glass-box">
                <h3 className="chart-title">RANKING DE PRODUCTIVIDAD (ESTUDIOS FIRMADOS)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rankingRendimiento} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} width={100} />
                        <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                        <Bar dataKey="total" fill="#fbbf24" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* COLUMNA DERECHA: DETALLE AUDITABLE */}
        <div className="table-audit-wrapper glass-box">
            <h3 className="chart-title">REGISTRO INDIVIDUAL DE ACTIVIDAD</h3>
            <table className="tabla-audit">
                <thead>
                    <tr>
                        <th>PROFESIONAL</th>
                        <th>PACIENTE</th>
                        <th>MODALIDAD</th>
                        <th>ESTADO</th>
                    </tr>
                </thead>
                <tbody>
                    {filtrados.map(d => (
                        <tr key={d.id}>
                            <td>
                                <div style={{fontWeight:'bold'}}>{d.profesional}</div>
                                <div style={{fontSize:'9px', color:'#fbbf24'}}>{d.rol}</div>
                            </td>
                            <td style={{color:'#94a3b8'}}>{d.paciente}</td>
                            <td>{d.modalidad}</td>
                            <td style={{color: d.estado === "Terminado" ? "#10b981" : "#3b82f6", fontWeight:'bold'}}>
                                {d.estado === "Terminado" ? "✓ OK" : "● PENDIENTE"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}