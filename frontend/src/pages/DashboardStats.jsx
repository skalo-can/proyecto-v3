import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "../AuthContext";

const COLORS = ["#fbbf24", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"];

export default function DashboardStats() {
  const { token } = useAuth();
  
  const [stats, setStats] = useState({
    pacientesTotal: 0,
    estudiosTotal: 0,
    imagenesTotal: 0,
    almacenamientoGB: "0.00",
    porcentajeNAS: 0,
    crecimiento: [],
    modalidades: [] 
  });

  const [filtros, setFiltros] = useState({ inicio: "", fin: "" });
  const [datosFiltrados, setDatosFiltrados] = useState({
    estudiosEnRango: 0,
    gbConsumidos: 0,
    porcentajeDelTotal: 0
  });

  useEffect(() => {
    fetchGlobalStats();
  }, [token]);

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/stats-dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) { console.error("Error stats:", error); }
  };

  const aplicarFiltro = () => {
    setDatosFiltrados({
      estudiosEnRango: 125,
      gbConsumidos: 45.8,
      porcentajeDelTotal: 15 
    });
  };

  return (
    <div style={{ 
      padding: '20px', 
      color: 'white', 
      backgroundColor: '#0f1114', 
      height: '100vh',           // Altura fija al 100% de la ventana
      width: '100%',             // Asegura el ancho total
      boxSizing: 'border-box',   // CRÍTICO: El padding no suma al tamaño total
      overflowY: 'auto',         // Scroll interno solo si el contenido crece mucho
      overflowX: 'hidden',       // Mata el scroll horizontal definitivamente
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{ color: '#fbbf24', marginBottom: '20px', borderLeft: '4px solid #fbbf24', paddingLeft: '15px', flexShrink: 0 }}>
        Panel de Control Estadístico
      </h2>

      {/* 🚀 TARJETAS GLOBALES SUPERIORES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px', flexShrink: 0 }}>
        <div style={cardStyle}><span style={labelStyle}>Total Pacientes</span><div style={valueStyle}>{stats.pacientesTotal}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Total Estudios</span><div style={{ ...valueStyle, color: '#fbbf24' }}>{stats.estudiosTotal}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Imágenes Almacenadas</span><div style={valueStyle}>{stats.imagenesTotal}</div></div>
        <div style={cardStyle}>
          <span style={labelStyle}>Capacidad Total NAS</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.almacenamientoGB} GB</div>
          <div style={progressBg}><div style={{ ...progressFill, width: `${stats.porcentajeNAS}%`, backgroundColor: '#10b981' }}></div></div>
          <small style={{ color: '#888' }}>{stats.porcentajeNAS}% ocupado global</small>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '30px', flexShrink: 0 }}>
        
        {/* 🔍 SECCIÓN DE FILTROS Y CONSUMO POR RANGO */}
        <div style={cardStyle}>
          <h3 style={{ color: '#fbbf24', fontSize: '1rem', marginBottom: '15px' }}>🔍 Filtro de Consumo por Periodo</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, inicio: e.target.value})} />
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, fin: e.target.value})} />
            <button onClick={aplicarFiltro} style={btnStyle}>Calcular</button>
          </div>
          
          <div style={{ padding: '15px', background: '#000', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={labelStyle}>Espacio Ocupado en este Rango:</span>
              <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{datosFiltrados.gbConsumidos} GB</span>
            </div>
            <div style={{ ...progressBg, height: '15px' }}>
              <div style={{ ...progressFill, width: `${datosFiltrados.porcentajeDelTotal}%`, backgroundColor: '#3b82f6' }}></div>
            </div>
            <small style={{ color: '#888' }}>Este periodo representa el {datosFiltrados.porcentajeDelTotal}% del consumo total.</small>
            <div style={{ marginTop: '10px', color: '#fff' }}>Estudios realizados: <strong>{datosFiltrados.estudiosEnRango}</strong></div>
          </div>
        </div>

        {/* 📉 GRÁFICO DE CRECIMIENTO LÍNEAL */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Crecimiento de Red</h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.crecimiento}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="fecha" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: '#1a1d21', border: '1px solid #444' }} />
                <Line type="monotone" dataKey="cantidad" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 🥧 DISTRIBUCIÓN POR MODALIDADES (TORTA + TABLA) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexShrink: 0 }}>
        <div style={cardStyle}>
          <h3 style={labelStyle}>Distribución de Modalidades (%)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.modalidades} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {stats.modalidades.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={labelStyle}>Detalle de Valores</h3>
          <table style={{ width: '100%', marginTop: '15px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Modalidad</th>
                <th style={{ padding: '10px' }}>Cantidad</th>
                <th style={{ padding: '10px' }}>Porcentaje</th>
              </tr>
            </thead>
            <tbody>
              {stats.modalidades.map((mod, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: COLORS[index % COLORS.length], marginRight: '10px', borderRadius: '2px' }}></div>
                    {mod.name}
                  </td>
                  <td style={{ padding: '12px' }}>{mod.value}</td>
                  <td style={{ padding: '12px', color: '#fbbf24' }}>
                    {((mod.value / stats.estudiosTotal) * 100).toFixed(1)}%
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

// ESTILOS DE OBJETOS
const cardStyle = { background: '#1a1d21', padding: '20px', borderRadius: '12px', border: '1px solid #333' };
const labelStyle = { color: '#aaa', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', display: 'block' };
const valueStyle = { fontSize: '2.2rem', fontWeight: 'bold', color: '#fff' };
const inputStyle = { background: '#000', border: '1px solid #444', color: '#fff', padding: '10px', borderRadius: '6px' };
const btnStyle = { background: '#fbbf24', color: '#000', border: 'none', padding: '10px 25px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const progressBg = { width: '100%', height: '8px', background: '#333', borderRadius: '10px', overflow: 'hidden', marginTop: '10px' };
const progressFill = { height: '100%', transition: 'width 1s ease-in-out' };