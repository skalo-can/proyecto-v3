import React from "react";

export default function FiltrosPacientes({
  filtros,
  modalitiesLista,
  loading,
  handleFiltroChange,
  setFiltroRapido,
  cargarDatos
}) {
  const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
  const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end' };
  const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
  const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
  const iSearch = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', width: '100%' };
  const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px' };
  const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem' };
  const btnBuscar = { background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', height: '38px', fontSize: '0.75rem' };

  return (
    <div style={filtrosBox}>
      <div style={filtrosFlex}>
        <div style={fGroup}>
          <label style={lStyle}>RÁPIDO</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button type="button" onClick={() => setFiltroRapido("HOY")} style={btnQuick}>HOY</button>
            <button type="button" onClick={() => setFiltroRapido("AYER")} style={btnQuick}>AYER</button>
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

        <div style={fGroup}>
          <label style={lStyle}>MODALIDAD</label>
          <select name="modalidad" style={sStyle} value={filtros.modalidad} onChange={handleFiltroChange}>
            <option value="">Todas</option>
            {modalitiesLista.map(m => (
              <option key={m} value={m.split(' ')[0]}>{m}</option>
            ))}
          </select>
        </div>

        {/* 🔥 FILTRO DE ESTADO OPERATIVO 100% SINCRONIZADO */}
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
          <label style={lStyle}>BÚSQUEDA PREDICTIVA GLOBAL</label>
          <input 
            type="text" 
            name="busqueda" 
            placeholder="Escribe Apellidos, Nombres o Cédula... ¡Filtra en vivo!" 
            style={iSearch} 
            value={filtros.busqueda} 
            onChange={handleFiltroChange}
          />
        </div>
        
        <div style={fGroup}>
          <button type="button" onClick={cargarDatos} style={btnBuscar}>
            {loading ? "⏳ FILTRANDO..." : "🔍 REFRESCO FORZADO"}
          </button>
        </div>
      </div>
    </div>
  );
}