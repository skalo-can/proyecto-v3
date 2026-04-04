import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState([]);
  
  // Filtros actualizados: 'tecnologo' ahora es un string que tú defines al escribir
  const [filtros, setFiltros] = useState({ 
    fechaDesde: "", 
    fechaHasta: "", 
    modalidad: "", 
    busqueda: "",
    tecnologo: "" 
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Función para establecer fechas rápidamente
  const establecerFiltroRapido = (tipo) => {
    const hoy = new Date().toISOString().split('T')[0];
    const ayerFecha = new Date();
    ayerFecha.setDate(ayerFecha.getDate() - 1);
    const ayer = ayerFecha.toISOString().split('T')[0];

    if (tipo === 'HOY') {
      setFiltros({ ...filtros, fechaDesde: hoy, fechaHasta: hoy });
    } else if (tipo === 'AYER') {
      setFiltros({ ...filtros, fechaDesde: ayer, fechaHasta: ayer });
    }
  };

  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/pacientes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setPacientes(data || []);
      } catch (error) {
        console.error("Error cargando pacientes:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPacientes();
  }, [token]);

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const terminadosSeleccionados = pacientes.filter(
    (p) => seleccionados.includes(p.id) && p.estado === "Terminado"
  );

  const getStatusColor = (est) => {
    const colores = { "Tomado": "#3b82f6", "Leido": "#8b5cf6", "Transcrito": "#ec4899", "Terminado": "#10b981", "Entregado": "#fbbf24" };
    return colores[est] || "#444";
  };

  if (loading) return <div style={{color: 'white', padding: '20px'}}>Cargando Panel de Control...</div>;

  return (
    <div style={mainLayout}>
      
      <div style={headerContainer}>
        <h2 style={tituloDorado}>Panel de Control y Productividad</h2>
        
        <div style={filtrosBox}>
          {/* BOTONES RÁPIDOS */}
          <div style={fGroup}>
            <label style={lStyle}>RÁPIDO:</label>
            <div style={{display: 'flex', gap: '5px'}}>
              <button style={btnQuick} onClick={() => establecerFiltroRapido('HOY')}>HOY</button>
              <button style={btnQuick} onClick={() => establecerFiltroRapido('AYER')}>AYER</button>
            </div>
          </div>

          <div style={fGroup}>
            <label style={lStyle}>DESDE:</label>
            <input type="date" style={iDate} value={filtros.fechaDesde} onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})} />
          </div>
          <div style={fGroup}>
            <label style={lStyle}>HASTA:</label>
            <input type="date" style={iDate} value={filtros.fechaHasta} onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})} />
          </div>

          {/* FILTRO DE TECNÓLOGO: Ahora es un INPUT de texto para mayor libertad */}
          <div style={fGroup}>
            <label style={lStyle}>BUSCAR TECNÓLOGO:</label>
            <input 
              type="text" 
              placeholder="Nombre tecnólogo..." 
              style={iDate} /* Usamos el mismo estilo de los inputs pequeños */
              value={filtros.tecnologo}
              onChange={(e) => setFiltros({...filtros, tecnologo: e.target.value})}
            />
          </div>

          <div style={fGroup}>
            <label style={lStyle}>MODALIDAD:</label>
            <select style={sStyle} value={filtros.modalidad} onChange={(e) => setFiltros({...filtros, modalidad: e.target.value})}>
              <option value="">Todas</option>
              <option value="CR">CR</option><option value="DR">DR</option>
              <option value="CT">CT</option><option value="MR">MR</option>
              <option value="US">US</option><option value="MG">MG</option>
              <option value="DENSITOMETRIA">DENSITOMETRIA</option>
              <option value="ANGIOGRAFIA">ANGIOGRAFIA</option>
            </select>
          </div>

          <input 
            type="text" 
            placeholder="Paciente o ID..." 
            style={iSearch} 
            value={filtros.busqueda}
            onChange={(e) => setFiltros({...filtros, busqueda: e.target.value})}
          />
          <button style={btnBuscar}>🔍 FILTRAR</button>
        </div>
      </div>

      <div style={tableContainer}>
        <table style={tableStyle}>
          <thead style={theadStyle}>
            <tr>
              <th style={thStyle}>SEL</th>
              <th style={thStyle}>ESTADO</th>
              <th style={thStyle}>PACIENTE</th>
              <th style={thStyle}>MOD/DEPTO</th>
              <th style={thStyle}>TECNÓLOGO</th> {/* Campo que recibe de la modalidad */}
              <th style={thStyle}>ENTREGA</th>
              <th style={thStyle}>FLUJO</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.length > 0 ? (
              pacientes.map((p) => (
                <tr key={p.id} style={trStyle}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={seleccionados.includes(p.id)} onChange={() => toggleSeleccion(p.id)} />
                  </td>
                  <td style={tdStyle}>
                    <span style={{ ...badge, backgroundColor: getStatusColor(p.estado) }}>{p.estado}</span>
                  </td>
                  <td style={tdStyle}>
                    <strong>{p.nombre} {p.apellidos}</strong>
                  </td>
                  <td style={tdStyle}>{p.modalidad}</td>
                  
                  {/* Aquí se muestra el campo tecnologo_nombre que viene de la BD */}
                  <td style={tdStyle}>
                    <span style={{color: '#e2e8f0', fontWeight: '500'}}>
                      {p.tecnologo_nombre || "---"}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <div style={{display:'flex', gap:'4px'}}>
                      <button style={{...btnS, background:'#25D366'}} title="WhatsApp">📱</button>
                      <button style={{...btnS, background:'#ea4335'}} title="Email">✉️</button>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <button style={btnDicom} onClick={() => navigate(`/pacientes/${p.id}/estudios`)}>👁️ VISOR</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" style={{padding:'20px', textAlign:'center', color:'#555'}}>No hay registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER DINÁMICO DE PRODUCTIVIDAD */}
      <div style={footerProductividad}>
        <span style={{color: '#94a3b8'}}>Estudios en lista: <b>{pacientes.length}</b></span>
        {filtros.tecnologo && (
          <span style={{color: '#fbbf24', marginLeft: '15px'}}> 
            | Productividad de <b>{filtros.tecnologo}</b>: <b>{pacientes.length}</b> pacientes atendidos
          </span>
        )}
      </div>

      {terminadosSeleccionados.length > 0 && (
        <div style={actionBar}>
          <span style={{color: 'black', fontWeight: 'bold'}}>✨ {terminadosSeleccionados.length} listos</span>
          <button style={btnB}>🚀 Enviar Pack</button>
          <button style={{ ...btnB, background: '#444' }} onClick={() => setSeleccionados([])}>Limpiar</button>
        </div>
      )}
    </div>
  );
}

// --- ESTILOS MANTENIDOS ---
const footerProductividad = {
  padding: '12px 25px',
  background: '#111418',
  borderTop: '1px solid #333',
  fontSize: '0.85rem',
  flexShrink: 0
};

const mainLayout = { height: 'calc(100vh - 100px)', margin: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1114', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden', position: 'relative' };
const headerContainer = { padding: '15px 25px', backgroundColor: '#111418', borderBottom: '1px solid #333', flexShrink: 0 };
const tableContainer = { flex: 1, overflowY: 'auto', padding: '0 25px 20px 25px', scrollbarWidth: 'thin', scrollbarColor: '#fbbf24 #0f1114' };
const theadStyle = { position: 'sticky', top: 0, background: '#111418', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.5)' };
const tituloDorado = { color: '#fbbf24', margin: '0 0 12px 0', fontSize: '1.4rem', fontWeight: 'bold' };
const filtrosBox = { display: 'flex', gap: '10px', background: '#1a1d21', padding: '10px', borderRadius: '8px', alignItems: 'flex-end', border: '1px solid #333' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '2px' };
const lStyle = { fontSize: '0.65rem', color: '#fbbf24', fontWeight: 'bold' };
const iDate = { background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px', fontSize: '0.8rem' };
const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '5px', borderRadius: '4px', fontSize: '0.8rem' };
const iSearch = { flex: 1, padding: '9px', background: '#000', color: '#fff', border: '1px solid #444', borderRadius: '4px' };
const btnBuscar = { background: '#fbbf24', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' };
const btnQuick = { background: '#334155', color: '#fbbf24', border: '1px solid #475569', padding: '5px 10px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' };
const thStyle = { padding: '12px 8px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333' };
const tdStyle = { padding: '12px 8px', borderBottom: '1px solid #222' };
const trStyle = { transition: '0.2s' };
const badge = { padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', fontWeight: 'bold' };
const btnS = { border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer' };
const btnDicom = { background: '#fbbf24', color: '#000', border: 'none', padding: '7px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' };
const actionBar = { position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', background: '#fbbf24', padding: '12px 35px', borderRadius: '50px', display: 'flex', gap: '25px', alignItems: 'center', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.8)' };
const btnB = { background: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold' };

export default Pacientes;