import React, { useEffect, useState } from "react";

export default function Productividad() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 1. TODOS LOS FILTROS INTEGRADOS (Operativos + Auditoría)
  const [filtros, setFiltros] = useState({ 
    rol: "TODOS", 
    nombreProfesional: "", 
    modalidad: "",
    fechaDesde: new Date().toISOString().split('T')[0], 
    fechaHasta: new Date().toISOString().split('T')[0] 
  });

  useEffect(() => {
    const generarDatosAudit = () => {
      const nombres = ["Dr. Salas", "Dra. Mendez", "Andres Garcia", "Beatriz Lopez", "Rosa Perez", "Luis Mora"];
      const modalidades = ["CR", "CT", "MR", "US", "MG"];
      const roles = ["MEDICO", "TECNOLOGO", "TRANSCRIPTOR"];
      
      const fakeData = Array.from({ length: 100 }, (_, i) => {
        const rolAsignado = roles[Math.floor(Math.random() * roles.length)];
        return {
          id: i,
          paciente: `Paciente Ref-${100 + i}`,
          profesional: nombres[Math.floor(Math.random() * nombres.length)],
          rol: rolAsignado,
          modalidad: modalidades[Math.floor(Math.random() * modalidades.length)],
          estado: Math.random() > 0.2 ? "Terminado" : "Pendiente",
          fecha: new Date().toISOString().split('T')[0]
        };
      });
      setDatos(fakeData);
      setLoading(false);
    };
    generarDatosAudit();
  }, []);

  // 2. LÓGICA DE FILTRADO MULTI-CRITERIO
  const filtrados = datos.filter(d => {
    const cumpleRol = filtros.rol === "TODOS" || d.rol === filtros.rol;
    const cumpleNombre = d.profesional.toLowerCase().includes(filtros.nombreProfesional.toLowerCase());
    const cumpleModalidad = !filtros.modalidad || d.modalidad === filtros.modalidad;
    const cumpleFecha = d.fecha >= filtros.fechaDesde && d.fecha <= filtros.fechaHasta;

    return cumpleRol && cumpleNombre && cumpleModalidad && cumpleFecha;
  });

  // MÉTRICAS EN TIEMPO REAL
  const total = filtrados.length;
  const terminados = filtrados.filter(d => d.estado === "Terminado").length;
  const eficiencia = total > 0 ? Math.round((terminados / total) * 100) : 0;

  if (loading) return <div style={{color:'white', padding:'50px'}}>Cargando Auditoría...</div>;

  return (
    <div style={layout}>
      {/* HEADER CON INDICADORES CLAVE */}
      <div style={headerStats}>
        <h2 style={goldTitle}>Métricas de Productividad y Auditoría</h2>
        <div style={cardsRow}>
            <div style={statCard}>
                <span style={cardLabel}>ESTUDIOS LISTADOS</span>
                <span style={cardValue}>{total}</span>
            </div>
            <div style={{...statCard, borderColor: '#10b981'}}>
                <span style={cardLabel}>FINALIZADOS</span>
                <span style={{...cardValue, color: '#10b981'}}>{terminados}</span>
            </div>
            <div style={{...statCard, borderColor: '#fbbf24'}}>
                <span style={cardLabel}>RENDIMIENTO</span>
                <span style={{...cardValue, color: '#fbbf24'}}>{eficiencia}%</span>
            </div>
        </div>
      </div>

      {/* BARRA DE FILTROS COMPLETA */}
      <div style={filterBar}>
        <div style={fRow}>
            <div style={fGroup}>
                <label style={lStyle}>ROL DEL PERSONAL:</label>
                <select style={sStyleGold} value={filtros.rol} onChange={(e) => setFiltros({...filtros, rol: e.target.value})}>
                    <option value="TODOS">Todos los Roles</option>
                    <option value="MEDICO">Médicos Radiólogos</option>
                    <option value="TECNOLOGO">Tecnólogos</option>
                    <option value="TRANSCRIPTOR">Transcriptores</option>
                </select>
            </div>

            <div style={fGroup}>
                <label style={lStyle}>NOMBRE DEL PROFESIONAL:</label>
                <input 
                    type="text" 
                    placeholder="Buscar médico, técnico..." 
                    style={iStyle} 
                    value={filtros.nombreProfesional}
                    onChange={(e) => setFiltros({...filtros, nombreProfesional: e.target.value})}
                />
            </div>

            <div style={fGroup}>
                <label style={lStyle}>MODALIDAD:</label>
                <select style={iStyle} value={filtros.modalidad} onChange={(e) => setFiltros({...filtros, modalidad: e.target.value})}>
                    <option value="">Todas</option>
                    <option value="CR">CR</option><option value="CT">CT</option>
                    <option value="MR">MR</option><option value="US">US</option>
                </select>
            </div>

            <div style={fGroup}>
                <label style={lStyle}>PERIODO DE TIEMPO:</label>
                <div style={{display:'flex', gap:'5px'}}>
                    <input type="date" style={iStyle} value={filtros.fechaDesde} onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})} />
                    <input type="date" style={iStyle} value={filtros.fechaHasta} onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})} />
                </div>
            </div>
        </div>
      </div>

      {/* TABLA DE RESULTADOS */}
      <div style={listContainer}>
        <table style={tStyle}>
            <thead>
                <tr style={thRow}>
                    <th style={th}>PROFESIONAL</th>
                    <th style={th}>ROL</th>
                    <th style={th}>MODALIDAD</th>
                    <th style={th}>PACIENTE</th>
                    <th style={th}>ESTADO</th>
                </tr>
            </thead>
            <tbody>
                {filtrados.map(item => (
                    <tr key={item.id} style={tr}>
                        <td style={td}><strong style={{color:'#fff'}}>{item.profesional}</strong></td>
                        <td style={td}><span style={rolTag(item.rol)}>{item.rol}</span></td>
                        <td style={td}>{item.modalidad}</td>
                        <td style={td} style={{color: '#94a3b8'}}>{item.paciente}</td>
                        <td style={td}>
                            <span style={{color: item.estado === "Terminado" ? "#10b981" : "#3b82f6", fontWeight: 'bold'}}>
                                {item.estado === "Terminado" ? "✓ FIRMADO" : "● EN PROCESO"}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

// ESTILOS ADAPTADOS
const layout = { padding: '25px', background: '#0b0e11', minHeight: '100vh', color: 'white' };
const goldTitle = { color: '#fbbf24', fontSize: '1.5rem', marginBottom: '20px' };
const headerStats = { marginBottom: '25px' };
const cardsRow = { display: 'flex', gap: '15px' };
const statCard = { background: '#111418', padding: '15px', borderRadius: '12px', border: '1px solid #333', flex: 1 };
const cardLabel = { display: 'block', color: '#64748b', fontSize: '0.65rem', fontWeight: '800', marginBottom: '5px' };
const cardValue = { fontSize: '1.8rem', fontWeight: '900' };

const filterBar = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #333' };
const fRow = { display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '5px' };
const lStyle = { fontSize: '0.65rem', color: '#fbbf24', fontWeight: 'bold' };
const sStyleGold = { background: '#fbbf24', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const iStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '10px', borderRadius: '6px', fontSize: '0.8rem' };

const listContainer = { background: '#111418', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden' };
const tStyle = { width: '100%', borderCollapse: 'collapse' };
const thRow = { background: '#1a1d21' };
const th = { padding: '15px', textAlign: 'left', color: '#fbbf24', fontSize: '0.75rem', textTransform: 'uppercase' };
const td = { padding: '12px 15px', borderBottom: '1px solid #222', fontSize: '0.85rem' };
const tr = { transition: '0.2s' };

const rolTag = (rol) => ({
    padding: '4px 8px', 
    borderRadius: '4px', 
    fontSize: '0.7rem', 
    fontWeight: 'bold',
    border: '1px solid',
    color: rol === 'MEDICO' ? '#ec4899' : rol === 'TECNOLOGO' ? '#3b82f6' : '#8b5cf6',
    borderColor: rol === 'MEDICO' ? '#ec4899' : rol === 'TECNOLOGO' ? '#3b82f6' : '#8b5cf6',
    background: 'rgba(255,255,255,0.05)'
});