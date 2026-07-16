import React from "react";

// 🚀 LISTA MAESTRA DE MODALIDADES
const MODALIDADES_MASTER = [
  "CT - Tomografía", 
  "MR - Resonancia", 
  "DX - Flat Panel (Directo)", 
  "CR - Casetes (Computarizado)", 
  "US - Ecografía",
  "MG - Mamografía",
  "DXA - Densitometría",
  "PET - PET Scan",
  "RF - Arco en C (Fluoroscopía)",
  "XA - Arco en C (Vascular)"
];

export default function FiltrosPacientes({
  filtros,
  loading,
  handleFiltroChange,
  setFiltroRapido,
  cargarDatos,
  busquedaProfunda,
  setBusquedaProfunda
}) {
  const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
  const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' };
  const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
  const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
  const iSearch = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', width: '100%', transition: 'all 0.3s' };
  const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', transition: 'all 0.3s' };
  
  // Estilos de botones rápidos compactos (Solo dejamos Hoy, Ayer, 7 Días)
  const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 8px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem', fontWeight: 'bold', transition: 'background 0.2s' };
  
  // 🔥 ESTILO DINÁMICO DEL BOTÓN DE BÚSQUEDA PROFUNDA (NEÓN)
  const btnDeepSearch = { 
    background: busquedaProfunda ? '#0ea5e9' : 'transparent', // Cyan vibrante si está activo
    color: busquedaProfunda ? '#fff' : '#0ea5e9', 
    border: `1px solid #0ea5e9`, 
    boxShadow: busquedaProfunda ? '0 0 12px rgba(14, 165, 233, 0.6)' : 'none',
    padding: '0 15px', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    height: '38px', 
    fontSize: '0.75rem', 
    fontWeight: 'bold',
    transition: 'all 0.3s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  };

  const btnBuscar = { background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', height: '38px', fontSize: '0.75rem' };

  return (
    <div style={filtrosBox}>
      <div style={filtrosFlex}>
        
        {/* INTERRUPTOR MAESTRO: BÚSQUEDA HISTÓRICA PROFUNDA */}
        <div style={fGroup}>
          <label style={{...lStyle, color: busquedaProfunda ? '#0ea5e9' : '#94a3b8'}}>MODO MOTOR DE BÚSQUEDA</label>
          <button 
            type="button" 
            onClick={() => setBusquedaProfunda(!busquedaProfunda)} 
            style={btnDeepSearch}
            title="Al activar, el sistema ignorará los límites de tiempo y buscará en toda la historia de la Base de Datos."
          >
            {busquedaProfunda ? "🌌 BÚSQUEDA PROFUNDA: ON" : "🔦 BÚSQUEDA PROFUNDA: OFF"}
          </button>
        </div>

        {/* CEREBRO CONDICIONAL DE FECHAS */}
        {busquedaProfunda ? (
          // SI ESTÁ ACTIVO: Mostramos un solo campo opcional con estilo neón
          <div style={fGroup}>
            <label style={{...lStyle, color: '#0ea5e9'}}>FECHA EXACTA (OPCIONAL)</label>
            <input 
              type="date" 
              name="fechaExacta" 
              style={{...sStyle, borderColor: '#0ea5e9', boxShadow: 'inset 0 0 5px rgba(14,165,233,0.2)'}} 
              value={filtros.fechaExacta || ""} 
              onChange={handleFiltroChange} 
            />
          </div>
        ) : (
          // SI ESTÁ APAGADO: Mostramos el filtro normal rápido y el rango Desde/Hasta
          <>
            <div style={fGroup}>
              <label style={lStyle}>RÁPIDO</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => setFiltroRapido("HOY")} style={btnQuick}>HOY</button>
                <button type="button" onClick={() => setFiltroRapido("AYER")} style={btnQuick}>AYER</button>
                <button type="button" onClick={() => setFiltroRapido("SEMANA")} style={btnQuick}>7 DÍAS</button>
              </div>
            </div>
            <div style={fGroup}>
              <label style={lStyle}>DESDE</label>
              <input type="date" name="fechaDesde" style={sStyle} value={filtros.fechaDesde} onChange={handleFiltroChange} />
            </div>
            <div style={fGroup}>
              <label style={lStyle}>HASTA</label>
              <input type="date" name="fechaHasta" style={sStyle} value={filtros.fechaHasta} onChange={handleFiltroChange} />
            </div>
          </>
        )}

        <div style={fGroup}>
          <label style={lStyle}>MODALIDAD</label>
          <select name="modalidad" style={sStyle} value={filtros.modalidad} onChange={handleFiltroChange}>
            <option value="">Todas</option>
            {MODALIDADES_MASTER.map(m => (
              <option key={m} value={m.split(' ')[0]}>{m}</option>
            ))}
          </select>
        </div>

        <div style={fGroup}>
          <label style={lStyle}>ESTADO</label>
          <select name="estado" style={{ ...sStyle, minWidth: '135px' }} value={filtros.estado} onChange={handleFiltroChange}>
            <option value="">-- Todos --</option>
            <option value="Tomado">🔵 Tomado</option>
            <option value="Importado">⚪ Importado</option>
            <option value="Urgencia">🚨 Urgencia</option>
            <option value="Dictado">🟠 Dictado</option>
            <option value="Transcrito">🟣 Transcrito</option>
            <option value="Firmado">🟢 Firmado</option>
            <option value="Entregado">🔮 Entregado</option>
            <option value="Rechazado">🛑 Rechazado</option>
            <option value="Cancelado">⚫ Cancelado</option>
          </select>
        </div>
        
        <div style={{ ...fGroup, flex: 1 }}>
          <label style={{...lStyle, color: busquedaProfunda ? '#0ea5e9' : '#fbbf24'}}>BÚSQUEDA PREDICTIVA GLOBAL</label>
          <input 
            type="text" 
            name="busqueda" 
            placeholder="Escribe Apellidos, Nombres o Cédula... ¡Filtra en vivo!" 
            style={{
              ...iSearch, 
              borderColor: busquedaProfunda ? '#0ea5e9' : '#444',
              boxShadow: busquedaProfunda ? '0 0 8px rgba(14, 165, 233, 0.3)' : 'none'
            }} 
            value={filtros.busqueda} 
            onChange={handleFiltroChange}
          />
        </div>
        
        <div style={fGroup}>
          <button type="button" onClick={cargarDatos} style={btnBuscar}>
            {loading ? "⏳ BUSCANDO..." : "🔍 REFRESCO FORZADO"}
          </button>
        </div>
      </div>
    </div>
  );
}