import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; 
// 🚀 Importamos formalmente tu archivo CSS para unificar la arquitectura
import "./pacientes.css"; 

export default function Pacientes() {
  const navigate = useNavigate();

  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [importando, setImportando] = useState(false);
  
  // 🧭 NUEVOS ESTADOS DE ORDENAMIENTO OPERATIVO
  const [sortBy, setSortBy] = useState("fecha"); // Opciones: id, paciente, fecha
  const [sortOrder, setSortOrder] = useState("desc"); // Opciones: asc, desc

  const hoyStr = new Date().toISOString().split('T')[0];

  // 📅 Estado unificado de los filtros del PACS (Predictivo en tiempo real)
  const [filtros, setFiltros] = useState({ 
    fechaDesde: "2020-01-01", 
    fechaHasta: hoyStr, 
    modalidad: "", 
    busqueda: "" 
  });

  const modalidadesLista = [
    "CT - Tomografía", "MR - Resonancia", "US - Ecografía", 
    "RX - Rayos X", "MG - Mamografía", "CR - Radiología Digital",
    "DXA - Densitometría", "PET - Medicina Nuclear"
  ];

  const cargarDatos = useCallback(() => {
    setLoading(true);
    
    const params = new URLSearchParams({
      fechaDesde: filtros.fechaDesde, 
      fechaHasta: filtros.fechaHasta, 
      modalidad: filtros.modalidad || "",
      busqueda: filtros.busqueda || "",
      sort_by: sortBy,
      order: sortOrder
    });

    fetch(`http://localhost:8000/api/pacientes?${params}`) 
      .then((res) => res.json())
      .then((data) => {
        setPacientes(Array.isArray(data) ? data : (data.items || []));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando el repositorio PACS:", err);
        setLoading(false);
      });
  }, [filtros, sortBy, sortOrder]); // 👈 ¡Cierre de useCallback completamente balanceado y reparado!

  useEffect(() => { 
    cargarDatos(); 
  }, [cargarDatos]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setSeleccionados([]); 
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  // 🔄 Manejador interactivo de ordenamiento al hacer clic en las cabeceras
  const solicitarOrdenamiento = (columna) => {
    if (sortBy === columna) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columna);
      setSortOrder("asc");
    }
  };

  // Renderizador de flechas indicadoras en las cabeceras
  const renderIconoOrden = (columna) => {
    if (sortBy !== columna) return <span style={{ color: '#475569', marginLeft: '5px' }}>↕</span>;
    return sortOrder === "asc" ? <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↑</span> : <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↓</span>;
  };

  // Alternar la selección (Checkbox + Clic en Nombre)
  const toggleSeleccionarPaciente = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ⚡ FILTROS RÁPIDOS
  const setFiltroRapido = (tipo) => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    setSeleccionados([]);
    
    if (tipo === "HOY") {
      setFiltros(prev => ({ ...prev, fechaDesde: hoyStr, fechaHasta: hoyStr }));
    } else if (tipo === "AYER") {
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      const ayerStr = ayer.toISOString().split('T')[0];
      setFiltros(prev => ({ ...prev, fechaDesde: ayerStr, fechaHasta: ayerStr }));
    }
  };

  const handleExportarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    alert(`📦 Exportando (${seleccionados.length}) estudios seleccionados.`);
    setSeleccionados([]);
  };

  const handleImportarDiscoExterno = async () => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    if (!token) { alert("🔒 Sesión Inválida"); return; }
    setImportando(true);
    try {
      const response = await fetch("http://localhost:8000/api/import/disco-externo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        alert(`🚀 ¡Explorador Vinculado!`);
        setTimeout(cargarDatos, 1000);
      }
    } catch (error) {
      alert("❌ Error de red.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={mainLayout}>
      <header style={headerContainer}>
        <div style={flexSpace}>
          <h2 style={tituloDorado}>Panel de Control Operativo</h2>
          <div style={headerActions}>
            <button style={btnProductividad} onClick={() => navigate("/productividad")}>📊 PANEL DE PRODUCTIVIDAD</button>
            <div style={contadorBadge}>
              <span style={labelContador}>ESTUDIOS EN PANTALLA:</span>
              <span style={valContador}>{pacientes.length}</span>
            </div>
          </div>
        </div>

        <div style={barraMedios}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleImportarDiscoExterno} 
              disabled={importando} 
              className="btn-importar-pacs"
              style={{ ...btnMediosImport, backgroundColor: importando ? '#475569' : '#2563eb' }}
            >
              {importando ? "⏳ PROCESANDO RUTA EXTERNA..." : "📥 IMPORTAR (CD/USB/PC)"}
            </button>
            
            <button 
              disabled={seleccionados.length === 0} 
              onClick={handleExportarSeleccionados} 
              className="btn-exportar-pacs"
              style={{ ...btnMediosExport, backgroundColor: seleccionados.length > 0 ? '#10b981' : '#334155' }}
            >
              {seleccionados.length > 0 ? `📥 EXPORTAR ESTUDIOS (${seleccionados.length})` : "Anular Selección (0)"}
            </button>
          </div>
          <span style={subLabel}>Estación de Gestión de Archivos Externos (Inyección Directa por Hardware)</span>
        </div>
        
        <div style={filtrosBox}>
          <div style={filtrosFlex}>
            <div style={fGroup}>
              <label style={lStyle}>RÁPIDO</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setFiltroRapido("HOY")} style={btnQuick}>HOY</button>
                <button onClick={() => setFiltroRapido("AYER")} style={btnQuick}>AYER</button>
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
                {modalidadesLista.map(m => (
                  <option key={m} value={m.split(' ')[0]}>{m}</option>
                ))}
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
              <button onClick={cargarDatos} style={btnBuscar}>
                {loading ? "⏳ FILTRANDO..." : "🔍 REFRESCO FORZADO"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 🟢 LA MAGIA OCURRE AQUÍ: Vinculamos tu clase custom-pacs-scroll desde el CSS */}
      <main style={tableContainer}>
        <div style={scrollWrapper} className="custom-pacs-scroll">
          <table style={tableStyle}>
            <thead style={theadStyle}>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" onChange={(e) => setSeleccionados(e.target.checked ? pacientes.map(p => p.id) : [])} checked={pacientes.length > 0 && seleccionados.length === pacientes.length} />
                </th>
                <th style={thStyle}>ESTADO</th>
                
                {/* 🎯 CABECERAS INTERACTIVAS CON EVENTO ONCLICK Y PROPIEDAD DE CURSOR */}
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>
                  ID PACIENTE {renderIconoOrden("id")}
                </th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>
                  PACIENTE {renderIconoOrden("paciente")}
                </th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>
                  FECHA ESTUDIO {renderIconoOrden("fecha")}
                </th> 
                
                <th style={thStyle}>SEXO</th>
                <th style={thStyle}>MODALIDAD</th>
                <th style={thStyle}>DEPTO.</th>
                <th style={thStyle}>DOCS</th>
                <th style={thStyle}>VISOR</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.length === 0 ? (
                <tr>
                  <td colSpan="10" style={waitingState}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📡</div>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>No se localizaron registros coincidentes.</p>
                  </td>
                </tr>
              ) : (
                pacientes.map((p) => {
                  const idReal = p.identificacion || p.id_paciente || "S/I";
                  const nombreReal = p.primer_nombre || p.nombre || "";
                  const apellidoReal = p.primer_apellido || p.apellido || "Desconocido";
                  const mReal = p.modalidad || p.tipo_estudio || "CR";
                  const fechaReal = p.fecha_estudio || p.fecha || "S/F"; 
                  const horaReal = p.hora_estudio || "00:00";

                  return (
                    <tr key={p.id} style={trStyle}>
                      <td style={tdStyle}>
                        <input 
                          type="checkbox" 
                          checked={seleccionados.includes(p.id)} 
                          onChange={() => toggleSeleccionarPaciente(p.id)} 
                        />
                      </td>
                      <td style={tdStyle}><span style={{ ...badge, backgroundColor: p.activo ? "#10b981" : "#3b82f6" }}>{p.activo ? "Terminado" : "Proceso"}</span></td>
                      <td style={tdStyle}>{idReal}</td>
                      
                      <td 
                        style={tdStyle} 
                        className="clickable-name" 
                        onClick={() => toggleSeleccionarPaciente(p.id)}
                      >
                        <strong>{apellidoReal}, {nombreReal}</strong>
                      </td>
                      
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={fechaBadge}>{fechaReal}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a8a29e', fontWeight: 'bold', fontFamily: 'monospace' }}>🕒 {horaReal}</span>
                        </div>
                      </td> 
                      
                      <td style={tdStyle}>{p.sexo || "M"}</td>
                      <td style={tdStyle}><strong>{mReal}</strong></td>
                      <td style={tdStyle}>{p.departamento || "Radiología"}</td>
                      <td style={tdStyle}>📕</td>
                      <td style={tdStyle}><button style={btnVisor}>ABRIR</button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// --- 🎨 OBJETOS DE ESTILOS MANTENIDOS AL 100% PARA RESPALDAR TU MAQUETA ---
const mainLayout = { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1114', overflow: 'hidden' };
const headerContainer = { padding: '15px 25px', background: '#111418', borderBottom: '2px solid #fbbf24', flexShrink: 0 };
const flexSpace = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const tituloDorado = { color: '#fbbf24', margin: 0, fontSize: '1.2rem', fontWeight: '800' };
const headerActions = { display: 'flex', gap: '12px', alignItems: 'center' };
const btnProductividad = { background: '#1a1d21', color: '#fff', border: '1px solid #fbbf24', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const contadorBadge = { background: '#1a1d21', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' };
const labelContador = { color: '#94a3b8', fontSize: '0.7rem' };
const valContador = { color: '#fbbf24', fontWeight: '900', fontSize: '1.1rem', marginLeft: '8px' };
const barraMedios = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d21', padding: '8px 15px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #444' };
const btnMediosImport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' };
const btnMediosExport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' };
const subLabel = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
const iSearch = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', width: '100%' };
const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px' };
const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem' };
const btnBuscar = { background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', height: '38px', fontSize: '0.75rem' };
const tableContainer = { flex: 1, padding: '10px 25px 25px 25px', overflow: 'hidden', display: 'flex', flexDirection: 'column' };

// Forzamos los desbordes en ambos ejes (¡Duplicación de scrollWrapper eliminada limpiamente!)
const scrollWrapper = { flex: 1, overflowY: 'scroll', overflowX: 'scroll', border: '1px solid #222', borderRadius: '6px', background: '#111418' };
const tableStyle = { width: '100%', minWidth: '1100px', borderCollapse: 'collapse' };
const theadStyle = { position: 'sticky', top: 0, background: '#16191e', zIndex: 10 }; 
const thStyle = { padding: '12px', textAlign: 'left', color: '#fbbf24', borderBottom: '2px solid #222', fontSize: '0.7rem' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #1f242d', color: '#e2e8f0', fontSize: '0.85rem' };
const trStyle = { borderBottom: '1px solid #111', background: '#111418' };
const waitingState = { textAlign: 'center', padding: '100px', color: '#64748b' };
const badge = { padding: '4px 10px', borderRadius: '5px', fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' };
const fechaBadge = { color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.85rem' };
const btnVisor = { background: '#fbbf24', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };