import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "../AuthContext";

const COLORS = ["#fbbf24", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"];

// 🚀 NUEVO: Selector de color dinámico basado en estándares predictivos de hardware
const obtenerColorBarra = (porcentaje) => {
  if (porcentaje >= 80) return "#ef4444"; // 🔴 Rojo Crítico: Momento de Purga
  if (porcentaje >= 60) return "#fbbf24"; // 🟡 Amarillo: Advertencia de espacio
  return "#10b981";                        // 🟢 Verde: Estado Óptimo
};

export default function DashboardStats() {
  const { token } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  const [stats, setStats] = useState({
    pacientesTotal: 0,
    estudiosTotal: 0,
    imagenesTotal: 0,
    almacenamientoGB: "0.00",
    porcentajeNAS: 0,
    discoTotalGB: 0,
    discoUsadoGB: 0,
    discoLibreGB: 0,
    limitePurga: 80,
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
    const timer = setTimeout(() => setIsMounted(true), 150);
    return () => clearTimeout(timer);
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
      estudiosEnRango: 0,
      gbConsumidos: 0,
      porcentajeDelTotal: 0 
    });
  };

  return (
    <div style={{ 
      padding: '20px', color: 'white', backgroundColor: '#0f1114', 
      height: '100vh', width: '100%', boxSizing: 'border-box', overflowY: 'auto' 
    }}>
      <h2 style={{ color: '#fbbf24', marginBottom: '20px', borderLeft: '4px solid #fbbf24', paddingLeft: '15px' }}>
        Panel de Control Estadístico
      </h2>

      {/* TARJETAS GLOBALES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><span style={labelStyle}>Total Pacientes</span><div style={valueStyle}>{stats.pacientesTotal}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Total Estudios</span><div style={{ ...valueStyle, color: '#fbbf24' }}>{stats.estudiosTotal}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Imágenes</span><div style={valueStyle}>{stats.imagenesTotal}</div></div>
        
        {/* 🚀 TARJETA OPTIMIZADA: Medición Dinámica de Almacenamiento y Barra Gradual */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={labelStyle}>Capacidad Almacenamiento</span>
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: obtenerColorBarra(stats.porcentajeNAS) }}>
              {stats.porcentajeNAS}%
            </span>
          </div>
          
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '2px' }}>
            {stats.almacenamientoGB} GB <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "normal" }}>local PACS</span>
          </div>
          
          {/* Barra Inteligente Estilizada */}
          <div style={{ ...progressBg, height: '8px', background: '#11141a', border: '1px solid #2a303c' }}>
            <div style={{ 
              ...progressFill, 
              width: `${stats.porcentajeNAS}%`, 
              backgroundColor: obtenerColorBarra(stats.porcentajeNAS) 
            }}></div>
          </div>

          {/* Desglose de Hardware Adicional */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#888", marginTop: "8px" }}>
            <span>Usado: <strong style={{ color: "#eee" }}>{stats.discoUsadoGB ? Math.round(stats.discoUsadoGB) : 0} GB</strong></span>
            <span>Libre: <strong style={{ color: obtenerColorBarra(stats.porcentajeNAS) }}>{stats.discoLibreGB ? Math.round(stats.discoLibreGB) : 0} GB</strong></span>
            <span>Total: {stats.discoTotalGB ? Math.round(stats.discoTotalGB) : 0} GB</span>
          </div>
        </div>
      </div>

      {/* ALERTAS PREDICTIVAS DE HARDWARE */}
      {stats.porcentajeNAS >= stats.limitePurga && (
        <div style={{
          padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444',
          borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px', color: '#ef4444',
          fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center'
        }}>
          ⚠️ ADVERTENCIA DE INFRAESTRUCTURA: Disco del PACS superior al {stats.limitePurga}%. Ciclo de depuración y purga hacia el NAS externo activo.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <h3 style={labelStyle}>🔍 Consumo por Periodo</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, inicio: e.target.value})} />
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, fin: e.target.value})} />
            <button onClick={aplicarFiltro} style={btnStyle}>Calcular</button>
          </div>
          <div style={{ padding: '10px', background: '#000', borderRadius: '8px' }}>
            <span style={labelStyle}>Ocupado en rango: {datosFiltrados.gbConsumidos} GB</span>
          </div>
        </div>

        {/* GRÁFICO 1 */}
        <div style={cardStyle}>
          <h3 style={labelStyle}>Crecimiento de Red</h3>
          <div style={{ textAlign: 'center' }}>
            {isMounted && (
              <LineChart width={350} height={200} data={stats.crecimiento}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="fecha" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ background: '#1a1d21', border: '1px solid #444' }} />
                <Line type="monotone" dataKey="cantidad" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', paddingBottom: '30px' }}>
        <div style={cardStyle}>
          <h3 style={labelStyle}>Distribución (%)</h3>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isMounted && (
              <PieChart width={350} height={300}>
                <Pie data={stats.modalidades} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.modalidades.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={labelStyle}>Detalle de Valores</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Mod.</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Cant.</th>
              </tr>
            </thead>
            <tbody>
              {stats.modalidades.map((mod, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '8px' }}>{mod.name}</td>
                  <td style={{ padding: '8px' }}>{mod.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ESTILOS (Respetados de tu base)
const cardStyle = { background: '#1a1d21', padding: '15px', borderRadius: '12px', border: '1px solid #333' };
const labelStyle = { color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', display: 'block' };
const valueStyle = { fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' };
const inputStyle = { background: '#000', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', width: '40%' };
const btnStyle = { background: '#fbbf24', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const progressBg = { width: '100%', height: '6px', background: '#333', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' };
const progressFill = { height: '100%', transition: 'width 1s ease-in-out' };