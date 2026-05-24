import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 

export default function Pacientes() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null); 

  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  
  const [filtros, setFiltros] = useState({ 
    fechaDesde: new Date().toISOString().split('T')[0], 
    fechaHasta: new Date().toISOString().split('T')[0], 
    modalidad: "", 
    busqueda: "" 
  });

  // --- MODALIDADES COMPLETAS RECUPERADAS ---
  const modalidadesLista = [
    "CT - Tomografía", "MR - Resonancia", "US - Ecografía", 
    "RX - Rayos X", "MG - Mamografía", "CR - Radiología Digital",
    "DXA - Densitometría", "PET - Medicina Nuclear"
  ];

  const cargarDatos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams(filtros);
    fetch(`http://localhost:8000/api/pacientes?${params}`) 
      .then((res) => res.json())
      .then((data) => {
        setPacientes(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error:", err);
        setLoading(false);
      });
  }, [filtros]);

  useEffect(() => { cargarDatos(); }, []);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  // --- LOGICA DE MEDIOS RECUPERADA ---
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
    try {
      const response = await fetch("http://localhost:8000/api/dicom/import", { method: "POST", body: formData });
      if (response.ok) { alert("✅ Importación Exitosa"); cargarDatos(); }
    } catch (err) { alert("❌ Error en servidor"); }
  };

  return (
    <div style={mainLayout}>
      <header style={headerContainer}>
        <div style={flexSpace}>
            <h2 style={tituloDorado}>Panel de Control Operativo</h2>
            <div style={headerActions}>
                <button style={btnProductividad} onClick={() => navigate("/productividad")}>📊 PANEL DE PRODUCTIVIDAD</button>
                <div style={contadorBadge}>
                    <span style={labelContador}>ESTUDIOS:</span>
                    <span style={valContador}>{pacientes.length}</span>
                </div>
            </div>
        </div>

        {/* 🚀 BOTONES DE IMPORTAR/EXPORTAR RECUPERADOS */}
        <div style={barraMedios}>
            <div style={{display:'flex', gap:'10px'}}>
              <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple webkitdirectory="true" onChange={handleFileChange} />
              <button 
                onClick={() => fileInputRef.current.click()}
                style={{ ...btnMediosImport, backgroundColor: '#2563eb' }}
              >📥 IMPORTAR (CD/USB/PC)</button>
              <button 
                disabled={seleccionados.length === 0} 
                style={{ ...btnMediosExport, opacity: seleccionados.length > 0 ? 1 : 0.4, backgroundColor: '#059669' }}
              >📤 EXPORTAR SELECCIÓN ({seleccionados.length})</button>
            </div>
            <span style={subLabel}>Estación de Gestión de Archivos Externos</span>
        </div>
        
        <div style={filtrosBox}>
          <div style={filtrosFlex}>
            <div style={fGroup}>
                <label style={lStyle}>RÁPIDO</label>
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => setFiltros({...filtros, fechaDesde: new Date().toISOString().split('T')[0], fechaHasta: new Date().toISOString().split('T')[0]})} style={btnQuick}>HOY</button>
                  <button onClick={() => setFiltros({...filtros, fechaDesde: new Date(Date.now() - 86400000).toISOString().split('T')[0], fechaHasta: new Date(Date.now() - 86400000).toISOString().split('T')[0]})} style={btnQuick}>AYER</button>
                </div>
            </div>
            <div style={fGroup}>
                <label style={lStyle}>DESDE</label>
                <input type="date" name="fechaDesde" style={iDate} value={filtros.fechaDesde} onChange={handleFiltroChange} />
            </div>
            <div style={fGroup}>
                <label style={lStyle}>HASTA</label>
                <input type="date" name="fechaHasta" style={iDate} value={filtros.fechaHasta} onChange={handleFiltroChange} />
            </div>
            <div style={fGroup}>
                <label style={lStyle}>MODALIDAD</label>
                <select name="modalidad" style={sStyle} value={filtros.modalidad} onChange={handleFiltroChange}>
                    <option value="">Todas</option>
                    {/* 🚀 LISTA DE MODALIDADES RECUPERADA */}
                    {modalidadesLista.map(m => (
                      <option key={m} value={m.split(' ')[0]}>{m}</option>
                    ))}
                </select>
            </div>
            <div style={{...fGroup, flex: 1}}>
                <label style={lStyle}>BUSCAR PACIENTE</label>
                <input type="text" name="busqueda" placeholder="ID o Apellidos..." style={iSearch} value={filtros.busqueda} onChange={handleFiltroChange} />
            </div>
            <div style={fGroup}>
                <button onClick={cargarDatos} style={btnBuscar}>🔍 BUSCAR REGISTROS</button>
            </div>
          </div>
        </div>
      </header>

      <main style={tableContainer}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>
              <th style={thStyle}><input type="checkbox" /></th>
              <th style={thStyle}>ESTADO</th>
              <th style={thStyle}>ID PACIENTE</th>
              <th style={thStyle}>PACIENTE</th>
              <th style={thStyle}>SEXO</th>
              <th style={thStyle}>MODALIDAD</th>
              <th style={thStyle}>DEPTO.</th>
              <th style={thStyle}>DOCS</th>
              <th style={thStyle}>ENTREGA REDUNDANTE</th>
              <th style={thStyle}>VISOR</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.length === 0 ? (
                <tr>
                  <td colSpan="10" style={waitingState}>
                    <div style={{fontSize: '3rem', marginBottom: '10px'}}>📡</div>
                    <p style={{margin: 0, fontWeight: 'bold'}}>Esperando datos de modalidades...</p>
                  </td>
                </tr>
            ) : (
                pacientes.map((p) => (
                    <tr key={p.id} style={trStyle}>
                      <td style={tdStyle}><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => setSeleccionados(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} /></td>
                      <td style={tdStyle}><span style={{ ...badge, backgroundColor: p.estado === "Terminado" ? "#10b981" : "#3b82f6" }}>{p.estado || "Proceso"}</span></td>
                      <td style={tdStyle}>{p.id_paciente}</td>
                      <td style={tdStyle}><strong>{p.nombre} {p.apellido}</strong></td>
                      <td style={tdStyle}>{p.sexo}</td>
                      <td style={tdStyle}><strong>{p.modalidad}</strong></td>
                      <td style={tdStyle}>{p.departamento}</td>
                      <td style={tdStyle}>📕</td>
                      <td style={tdStyle}>WA / Mail</td>
                      <td style={tdStyle}><button style={btnVisor}>ABRIR</button></td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}

// --- ESTILOS COMPLETO ---
const mainLayout = { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1114', overflow: 'hidden' };
const headerContainer = { padding: '15px 25px', background: '#111418', borderBottom: '2px solid #fbbf24' };
const flexSpace = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const tituloDorado = { color: '#fbbf24', margin: 0, fontSize: '1.2rem', fontWeight: '800' };
const headerActions = { display: 'flex', gap: '12px', alignItems: 'center' };
const btnProductividad = { background: '#1a1d21', color: '#fff', border: '1px solid #fbbf24', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const contadorBadge = { background: '#1a1d21', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' };
const labelContador = { color: '#94a3b8', fontSize:'0.7rem' };
const valContador = { color: '#fbbf24', fontWeight: '900', fontSize: '1.1rem', marginLeft:'8px' };
const barraMedios = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d21', padding: '8px 15px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #444' };
const btnMediosImport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' };
const btnMediosExport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' };
const subLabel = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
const iDate = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem' };
const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px' };
const iSearch = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', width: '100%' };
const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem' };
const btnBuscar = { background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', height: '38px', fontSize: '0.75rem' };
const tableContainer = { flex: 1, overflowY: 'auto', padding: '10px 25px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadStyle = { position: 'sticky', top: 0, background: '#1a1d21', zIndex: 10 };
const thStyle = { padding: '12px', textAlign: 'left', color: '#fbbf24', borderBottom: '1px solid #444', fontSize: '0.7rem' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #333', color: '#e2e8f0', fontSize: '0.85rem' };
const trStyle = { borderBottom: '1px solid #222' };
const waitingState = { textAlign: 'center', padding: '100px', color: '#64748b' };
const badge = { padding: '4px 10px', borderRadius: '5px', fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' };
const btnVisor = { background: '#fbbf24', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };