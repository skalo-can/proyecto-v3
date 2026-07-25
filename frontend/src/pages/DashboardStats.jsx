import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useAuth } from "../AuthContext";

// 🎨 PALETA DE COLORES INSTITUCIONAL EXACTA
const MODALIDAD_COLORS = { 
  CT: "#3b82f6", // Azul
  MR: "#8b5cf6", // Morado
  DX: "#10b981", // Verde
  CR: "#fbbf24", // Dorado / Amarillo
  US: "#f472b6", // Rosa
  MG: "#38bdf8", // Celeste
  DXA: "#a3e635", // Lima
  PET: "#f87171", // Rojo
  RF: "#c084fc", // Púrpura claro
  XA: "#fb923c"  // Naranja
};

const obtenerColorBarra = (porcentaje) => {
  if (porcentaje >= 80) return "#ef4444"; 
  if (porcentaje >= 60) return "#fbbf24"; 
  return "#10b981";                       
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
    pacientesEnRango: 0,
    estudiosEnRango: 0,
    imagenesEnRango: 0,
    gbConsumidos: "0.00",
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
        if (data && typeof data === 'object') {
          setStats(prev => ({ ...prev, ...data }));
        }
      }
    } catch (error) { console.error("Error stats:", error); }
  };

  const aplicarFiltro = async () => {
    if (!filtros.inicio || !filtros.fin) {
      alert("⚠️ Por favor selecciona una fecha de inicio y fin.");
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/stats-dashboard?inicio=${filtros.inicio}&fin=${filtros.fin}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const dataPeriodo = await response.json();
        
        const discoRealGlobal = stats.discoUsadoGB || 0;
        let gbCalculados = "0.00";
        
        if (stats.imagenesTotal > 0 && dataPeriodo.imagenesTotal > 0) {
            const proporcionPeriodo = dataPeriodo.imagenesTotal / stats.imagenesTotal;
            gbCalculados = (discoRealGlobal * proporcionPeriodo).toFixed(2);
        }

        const porcentajeDelDisco = stats.discoTotalGB > 0 
          ? ((gbCalculados / stats.discoTotalGB) * 100).toFixed(1) 
          : 0;

        setDatosFiltrados({
          pacientesEnRango: dataPeriodo.pacientesTotal || 0,
          estudiosEnRango: dataPeriodo.estudiosTotal || 0,
          imagenesEnRango: dataPeriodo.imagenesTotal || 0,
          gbConsumidos: gbCalculados,
          porcentajeDelTotal: porcentajeDelDisco 
        });
      }
    } catch (error) { 
      console.error("Error al filtrar stats por periodo:", error); 
    }
  };

  const modalidadesSeguras = stats?.modalidades || [];
  const crecimientoSeguro = stats?.crecimiento || [];
  const totalEstudiosDona = modalidadesSeguras.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const modalidadesActivas = modalidadesSeguras.map(m => m.name);

  // 🟢 LECTURA ESTRICTA DE LA BASE DE DATOS (CERO ESTIMACIONES)
  const datosGrafica = crecimientoSeguro.map(punto => {
    let puntoFormateado = { fecha: punto.fecha, total: punto.cantidad };
    let desglosesBackend = punto.modalidades || {};
    
    // Solo agrega modalidades si el backend las envía explícitamente para ese día
    if (Object.keys(desglosesBackend).length > 0) {
      puntoFormateado = { ...puntoFormateado, ...desglosesBackend };
    } 
    return puntoFormateado;
  });

  // 🟢 TOOLTIP ESTRICTO: Solo muestra lo que existe
  const CustomTooltipLine = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = data.total || data.cantidad || 0;
      
      let desgloses = [];
      Object.keys(MODALIDAD_COLORS).forEach(mod => {
        // Solo lista la modalidad si existe en el objeto y es mayor a 0
        if (data[mod] !== undefined && data[mod] > 0 && mod !== 'total' && mod !== 'cantidad') {
          desgloses.push({ mod, valor: data[mod] });
        }
      });

      return (
        <div style={{ background: '#1a1d21', border: '1px solid #4a5066', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '0.8rem', boxShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>
          <p style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '6px', color: '#a0aabf', fontWeight: 'bold' }}>
            Fecha: {label}
          </p>
          
          {desgloses.length > 0 ? (
            <>
              {desgloses.map(item => (
                <div key={item.mod} style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginBottom: '6px' }}>
                  <span style={{ color: MODALIDAD_COLORS[item.mod], fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: MODALIDAD_COLORS[item.mod] }}></span>
                    {item.mod}
                  </span>
                  <span>{item.valor} Estudios</span>
                </div>
              ))}
              {desgloses.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #444' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>Total Día:</span>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>{total} Estudios</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px' }}>
              <span style={{ color: '#a0aabf', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a0aabf' }}></span>
                Total General
              </span>
              <span style={{ fontWeight: 'bold' }}>{total} Estudios</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderTooltipFormatterPie = (value, name) => {
    const porcentaje = totalEstudiosDona > 0 ? ((value / totalEstudiosDona) * 100).toFixed(1) : 0;
    return [`${value} Estudios (${porcentaje}%)`, name];
  };

  return (
    <div style={{ padding: '20px', color: 'white', backgroundColor: '#0f1114', height: '100vh', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <h2 style={{ color: '#fbbf24', marginBottom: '20px', borderLeft: '4px solid #fbbf24', paddingLeft: '15px' }}>
        Panel de Control Estadístico
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}><span style={labelStyle}>Total Pacientes</span><div style={valueStyle}>{stats.pacientesTotal || 0}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Total Estudios</span><div style={{ ...valueStyle, color: '#fbbf24' }}>{stats.estudiosTotal || 0}</div></div>
        <div style={cardStyle}><span style={labelStyle}>Total Imágenes</span><div style={valueStyle}>{stats.imagenesTotal || 0}</div></div>
        
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={labelStyle}>Capacidad Almacenamiento</span>
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: obtenerColorBarra(stats.porcentajeNAS) }}>{stats.porcentajeNAS || 0}%</span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '2px' }}>
            {stats.almacenamientoGB > 0 ? stats.almacenamientoGB : (stats.discoUsadoGB || "0.00")} GB <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: "normal" }}>local PACS</span>
          </div>
          <div style={{ ...progressBg, height: '8px', background: '#11141a', border: '1px solid #2a303c' }}>
            <div style={{ ...progressFill, width: `${stats.porcentajeNAS || 0}%`, backgroundColor: obtenerColorBarra(stats.porcentajeNAS) }}></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#888", marginTop: "8px" }}>
            <span>Usado: <strong style={{ color: "#eee" }}>{stats.discoUsadoGB ? Math.round(stats.discoUsadoGB) : 0} GB</strong></span>
            <span>Libre: <strong style={{ color: obtenerColorBarra(stats.porcentajeNAS) }}>{stats.discoLibreGB ? Math.round(stats.discoLibreGB) : 0} GB</strong></span>
            <span>Total: {stats.discoTotalGB ? Math.round(stats.discoTotalGB) : 0} GB</span>
          </div>
        </div>
      </div>

      {stats.porcentajeNAS >= stats.limitePurga && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
          ⚠️ ADVERTENCIA DE INFRAESTRUCTURA: Disco del PACS superior al {stats.limitePurga}%. Ciclo de depuración y purga hacia el NAS externo activo.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div style={cardStyle}>
          <h3 style={labelStyle}>🔍 Consumo por Periodo</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, inicio: e.target.value})} />
            <input type="date" style={inputStyle} onChange={(e) => setFiltros({...filtros, fin: e.target.value})} />
            <button onClick={aplicarFiltro} style={btnStyle}>Calcular</button>
          </div>
          <div style={{ padding: '15px', background: '#11141a', borderRadius: '8px', border: '1px solid #2a303c', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '15px', textAlign: 'center' }}>
            <div><span style={{...labelStyle, marginBottom: '4px', fontSize: '0.7rem'}}>Pacientes:</span><span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#8b5cf6' }}>{datosFiltrados.pacientesEnRango}</span></div>
            <div><span style={{...labelStyle, marginBottom: '4px', fontSize: '0.7rem'}}>Estudios:</span><span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3b82f6' }}>{datosFiltrados.estudiosEnRango}</span></div>
            <div><span style={{...labelStyle, marginBottom: '4px', fontSize: '0.7rem'}}>Imágenes:</span><span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fbbf24' }}>{datosFiltrados.imagenesEnRango}</span></div>
            <div><span style={{...labelStyle, marginBottom: '4px', fontSize: '0.7rem'}}>Espacio (GB):</span><span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{datosFiltrados.gbConsumidos}</span></div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={labelStyle}>Crecimiento de Red por Modalidad</h3>
          <div style={{ textAlign: 'center', width: '100%', height: '200px' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosGrafica} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="fecha" stroke="#888" fontSize={10} label={{ value: "Línea de Tiempo (Días)", position: "insideBottom", offset: -15, fill: "#888", fontSize: 11 }} />
                  <YAxis stroke="#888" fontSize={10} label={{ value: "Cantidad de Estudios", angle: -90, position: "insideLeft", offset: -5, fill: "#888", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltipLine />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  
                  {modalidadesActivas.map(mod => (
                    <Area key={mod} type="monotone" dataKey={mod} stackId="1" stroke={MODALIDAD_COLORS[mod]} fillOpacity={0.6} fill={MODALIDAD_COLORS[mod]} isAnimationActive={true} />
                  ))}
                  
                  {/* Línea Neutra de respaldo si el backend no manda desgloses por modalidad */}
                  {(!datosGrafica.some(d => modalidadesActivas.some(m => d[m] !== undefined))) && (
                    <Area type="monotone" dataKey="total" stroke="#a0aabf" fillOpacity={0.3} fill="#a0aabf" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', paddingBottom: '30px' }}>
        <div style={cardStyle}>
          <h3 style={labelStyle}>Distribución (%)</h3>
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '300px' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modalidadesSeguras} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {modalidadesSeguras.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={MODALIDAD_COLORS[entry.name] || '#888'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1d21', border: '1px solid #444', borderRadius: '6px' }} formatter={renderTooltipFormatterPie} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={labelStyle}>Detalle de Valores</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Mod.</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Pacientes</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Estudios</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Imágenes</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Porcentaje (%)</th> 
              </tr>
            </thead>
            <tbody>
              {modalidadesSeguras.map((mod, index) => {
                const pctFila = totalEstudiosDona > 0 ? ((mod.value / totalEstudiosDona) * 100).toFixed(1) : "0.0";
                const colorDeLaModalidad = MODALIDAD_COLORS[mod.name] || '#888';

                return (
                  <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '8px', color: colorDeLaModalidad, fontWeight: 'bold' }}>{mod.name}</td>
                    <td style={{ padding: '8px', color: colorDeLaModalidad, fontWeight: 'bold' }}>{mod.pacientes || 0}</td>
                    <td style={{ padding: '8px', color: colorDeLaModalidad, fontWeight: 'bold' }}>{mod.value}</td>
                    <td style={{ padding: '8px', color: colorDeLaModalidad, fontWeight: 'bold' }}>{mod.imagenes || 0}</td>
                    <td style={{ padding: '8px', color: colorDeLaModalidad, fontFamily: 'monospace', fontWeight: 'bold' }}>{pctFila}%</td> 
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const cardStyle = { background: '#1a1d21', padding: '15px', borderRadius: '12px', border: '1px solid #333' };
const labelStyle = { color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', display: 'block' };
const valueStyle = { fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' };
const inputStyle = { background: '#000', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', flex: '1', minWidth: '120px' };
const btnStyle = { background: '#fbbf24', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const progressBg = { width: '100%', height: '6px', background: '#333', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' };
const progressFill = { height: '100%', transition: 'width 1s ease-in-out' };