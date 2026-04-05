import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * COMPONENTE: Panel de Control Operativo (PRODUCCIÓN)
 * ESTADO: Limpio / Listo para recepción de datos de modalidades.
 */

export default function Pacientes() {
  const navigate = useNavigate();
  
  // ESTADOS INICIALES LIMPIOS
  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [filtros, setFiltros] = useState({ 
    fechaDesde: new Date().toISOString().split('T')[0], // Inicia en HOY
    fechaHasta: new Date().toISOString().split('T')[0], 
    modalidad: "", 
    busqueda: "" 
  });

  const nombresModalidades = {
    "CR": "Radiología Convencional (CR)", "DR": "Radiología Digital (DR)", "CT": "Tomografía (CT)",
    "MR": "Resonancia (MR)", "US": "Ecografía (US)", "MG": "Mamografía (MG)",
    "FL": "Fluoroscopia (FL)", "MN": "Medicina Nuclear (MN)", "ANGIO": "Angiografía", "DXA": "Densitometría (DXA)"
  };

  useEffect(() => {
    // AQUÍ CONECTARÁS TU API FETCH O WEBSOCKET
    const conectarModalidades = async () => {
        try {
            // Simulación de espera de red (reemplazar por fetch real)
            setLoading(true);
            // const response = await fetch('/api/pacientes');
            // const data = await response.json();
            // setPacientes(data);
            setLoading(false);
        } catch (error) {
            console.error("Error conectando con el servidor de modalidades", error);
            setLoading(false);
        }
    };
    conectarModalidades();
  }, []);

  const establecerFiltroRapido = (tipo) => {
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (tipo === 'HOY') setFiltros({ ...filtros, fechaDesde: hoy, fechaHasta: hoy });
    if (tipo === 'AYER') setFiltros({ ...filtros, fechaDesde: ayer, fechaHasta: ayer });
  };

  const pacientesFiltrados = pacientes.filter(p => 
    (!filtros.modalidad || p.modalidad === filtros.modalidad) &&
    (!filtros.busqueda || p.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase()))
  );

  // Lógica de validación para envío masivo seguro
  const pacientesListosParaEnvio = pacientes.filter(p => seleccionados.includes(p.id_db) && p.estado === "Terminado");
  const cantidadEnviables = pacientesListosParaEnvio.length;

  if (loading) return <div style={loadingScreen}>Sincronizando con base de datos de modalidades...</div>;

  return (
    <div style={mainLayout}>
      
      {/* CABECERA */}
      <header style={headerContainer}>
        <div style={flexSpace}>
            <h2 style={tituloDorado}>Panel de Control Operativo</h2>
            <div style={headerActions}>
                <button style={btnProductividad} onClick={() => navigate("/productividad")}>
                    📊 PANEL DE PRODUCTIVIDAD
                </button>
                {seleccionados.length === 1 && (
                  <button style={btnModificar} onClick={() => setEditandoId(seleccionados[0])}>📝 MODIFICAR DATOS</button>
                )}
                <div style={contadorBadge}>
                    <span style={labelContador}>ESTUDIOS:</span>
                    <span style={valContador}>{pacientesFiltrados.length}</span>
                </div>
            </div>
        </div>
        
        {/* GESTIÓN DE MEDIOS */}
        <div style={barraMedios}>
           <div style={{display:'flex', gap:'10px'}}>
              <button style={btnMediosImport}>📥 IMPORTAR (CD/USB/PC)</button>
              <button style={{...btnMediosExport, opacity: seleccionados.length > 0 ? 1 : 0.4}} disabled={seleccionados.length === 0}>📤 EXPORTAR SELECCIÓN</button>
           </div>
           <span style={subLabel}>Estación de Gestión de Archivos Externos</span>
        </div>

        {/* FILTROS */}
        <div style={filtrosBox}>
          <div style={filtrosFlex}>
            <div style={fGroup}>
                <label style={lStyle}>RÁPIDO</label>
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => establecerFiltroRapido('HOY')} style={btnQuick}>HOY</button>
                  <button onClick={() => establecerFiltroRapido('AYER')} style={btnQuick}>AYER</button>
                </div>
            </div>
            <div style={fGroup}><label style={lStyle}>DESDE</label><input type="date" style={iDate} value={filtros.fechaDesde} onChange={(e)=>setFiltros({...filtros, fechaDesde: e.target.value})} /></div>
            <div style={fGroup}><label style={lStyle}>HASTA</label><input type="date" style={iDate} value={filtros.fechaHasta} onChange={(e)=>setFiltros({...filtros, fechaHasta: e.target.value})} /></div>
            <div style={fGroup}>
                <label style={lStyle}>MODALIDAD</label>
                <select style={sStyle} value={filtros.modalidad} onChange={(e)=>setFiltros({...filtros, modalidad: e.target.value})}>
                    <option value="">Todas</option>
                    {Object.entries(nombresModalidades).map(([sigla, nombre]) => (<option key={sigla} value={sigla}>{nombre}</option>))}
                </select>
            </div>
            <div style={{...fGroup, flex: 1}}><label style={lStyle}>BUSCAR PACIENTE</label><input type="text" placeholder="ID o Apellidos..." style={iSearch} onChange={(e)=>setFiltros({...filtros, busqueda: e.target.value})} /></div>
          </div>
        </div>
      </header>

      {/* ÁREA DE TABLA */}
      <main style={tableContainer}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>
              <th style={thStyle}><input type="checkbox" onChange={(e) => setSeleccionados(e.target.checked ? pacientesFiltrados.map(p=>p.id_db) : [])} /></th>
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
            {pacientesFiltrados.length === 0 ? (
                <tr>
                    <td colSpan="10" style={{padding: '100px', textAlign: 'center', color: '#444'}}>
                        <div style={{fontSize: '3rem'}}>📡</div>
                        <p style={{fontSize: '1rem', fontWeight: 'bold'}}>Esperando datos de modalidades...</p>
                        <p style={{fontSize: '0.8rem'}}>No se han encontrado estudios para la fecha seleccionada.</p>
                    </td>
                </tr>
            ) : (
                pacientesFiltrados.map((p) => (
                    <tr key={p.id_db} style={{...trStyle, background: seleccionados.includes(p.id_db) ? '#2d333b' : '#1a1d21'}}>
                      <td style={tdStyle}><input type="checkbox" checked={seleccionados.includes(p.id_db)} onChange={() => setSeleccionados(prev => prev.includes(p.id_db) ? prev.filter(x => x !== p.id_db) : [...prev, p.id_db])} /></td>
                      <td style={tdStyle}><span style={{ ...badge, backgroundColor: p.estado === "Terminado" ? "#10b981" : p.estado === "En Proceso" ? "#f59e0b" : "#3b82f6" }}>{p.estado}</span></td>
                      <td style={tdStyle}>{p.id_paciente}</td>
                      <td style={tdStyle}>
                          <div>
                            <strong style={{color: '#fff'}}>{p.nombre}</strong><br/>
                            <small style={{color: p.email ? '#64748b' : '#ef4444'}}>{p.email || "⚠️ Sin Contacto"}</small>
                          </div>
                      </td>
                      <td style={tdStyle}>{p.sexo}</td>
                      <td style={tdStyle}><strong>{p.modalidad}</strong></td>
                      <td style={tdStyle}>{p.departamento}</td>
                      <td style={tdStyle}><div style={docsFlex}><span style={{ opacity: p.hasPDF ? 1 : 0.1 }}>📕</span><span style={{ opacity: p.hasAudio ? 1 : 0.1 }}>🎙️</span></div></td>
                      <td style={tdStyle}>
                        <div style={{display:'flex', gap:'8px', opacity: p.estado === "Terminado" ? 1 : 0.2}}>
                          <button disabled={p.estado !== "Terminado"} style={btnCanal}><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="14" alt="WA" /></button>
                          <button disabled={p.estado !== "Terminado"} style={{...btnCanal, background: '#fff'}}><img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" width="14" alt="Mail" /></button>
                        </div>
                      </td>
                      <td style={tdStyle}><button style={btnVisor}>ABRIR</button></td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </main>

      {/* BARRA DORADA: ENVÍO MASIVO SISTEMATIZADO */}
      {seleccionados.length >= 2 && (
        <div style={barraMasiva}>
          <div style={masivaTextGroup}>
             <div style={iconRocket}>🚀</div>
             <div>
                <span style={masivaTitle}>ENVÍO MASIVO SISTEMATIZADO</span>
                <span style={masivaSub}>
                  {cantidadEnviables} de {seleccionados.length} seleccionados listos (Solo "Terminados").
                </span>
             </div>
          </div>
          <button 
            style={{...btnConfirmarMasivo, opacity: cantidadEnviables > 0 ? 1 : 0.5}} 
            disabled={cantidadEnviables === 0}
            onClick={() => alert(`Iniciando envío de ${cantidadEnviables} resultados...`)}>
            {cantidadEnviables > 0 ? 'EJECUTAR ENVÍO MASIVO' : 'SIN ESTUDIOS TERMINADOS'}
          </button>
        </div>
      )}

    </div>
  );
}

// --- ESTILOS DE PRODUCCIÓN ---
const mainLayout = { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1114', overflow: 'hidden', position: 'relative' };
const loadingScreen = { color: 'white', padding: '40px', background: '#0f1114', height: '100vh', display:'flex', alignItems:'center', justifyContent:'center' };
const headerContainer = { padding: '15px 25px', background: '#111418', borderBottom: '2px solid #fbbf24' };
const flexSpace = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const headerActions = { display: 'flex', gap: '12px', alignItems: 'center' };
const tituloDorado = { color: '#fbbf24', margin: 0, fontSize: '1.2rem', fontWeight: '800' };
const btnProductividad = { background: '#1a1d21', color: '#fff', border: '1px solid #fbbf24', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const btnModificar = { background: '#fbbf24', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const contadorBadge = { background: '#1a1d21', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' };
const labelContador = { color: '#94a3b8', fontSize:'0.7rem' };
const valContador = { color: '#fbbf24', fontWeight: '900', fontSize: '1.1rem', marginLeft:'8px' };
const barraMedios = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d21', padding: '8px 15px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #444' };
const btnMediosImport = { background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' };
const btnMediosExport = { background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem', cursor: 'pointer' };
const subLabel = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end', width: '100%' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
const iDate = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem' };
const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px' };
const iSearch = { width: '100%', padding: '8px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px', height: '38px' };
const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem' };
const tableContainer = { flex: 1, overflowY: 'auto', padding: '10px 25px 120px 25px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadStyle = { position: 'sticky', top: 0, background: '#1a1d21', zIndex: 10 };
const thStyle = { padding: '12px', textAlign: 'left', color: '#fbbf24', borderBottom: '1px solid #444', fontSize: '0.7rem' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #333', color: '#e2e8f0', fontSize: '0.85rem' };
const trStyle = { transition: '0.2s' };
const badge = { padding: '4px 10px', borderRadius: '5px', fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' };
const btnVisor = { background: '#fbbf24', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const btnCanal = { background: 'transparent', border: '1px solid #444', padding: '6px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const docsFlex = { display: 'flex', gap: '12px', fontSize: '1.2rem' };
const barraMasiva = { position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '80%', background: '#fbbf24', padding: '20px 40px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.9)', zIndex: 100, border: '3px solid #000' };
const masivaTextGroup = { display: 'flex', alignItems: 'center', gap: '20px' };
const masivaTitle = { color: '#000', fontWeight: '900', fontSize:'1.1rem', display:'block' };
const masivaSub = { color: '#444', fontSize:'0.75rem', fontWeight:'bold' };
const iconRocket = { fontSize: '2.5rem' };
const btnConfirmarMasivo = { background: '#000', color: '#fbbf24', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '0.9rem' };