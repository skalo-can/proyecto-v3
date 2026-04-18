import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import Filtros from "../components/Filtros/Filtros";
import "./Pacientes.css";

export default function Pacientes() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null); // Referencia para el selector de archivos

  const [pacientes, setPacientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState({ id: "", nombre: "", apellido: "", fecha: "" });
  const [pagina, setPagina] = useState(0);
  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState("asc");

  const limit = 20;

  // Carga de datos con soporte Real-Time
  const cargarDatos = useCallback(() => {
    const params = new URLSearchParams({ ...filtros, sort, order, limit, offset: pagina * limit });
    fetch(`http://localhost:8000/filtros/pacientes?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPacientes(data.items);
        setTotal(data.total);
      })
      .catch((err) => console.error("Error:", err));
  }, [filtros, pagina, sort, order]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Lógica Botón Azul (Importar)
  const handleImportClick = () => {
    fileInputRef.current.click(); // Dispara el selector de archivos
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
    
    try {
      const response = await fetch("http://localhost:8000/api/dicom-import", { method: "POST", body: formData });
      if (response.ok) { 
        alert("✅ DICOM Importado con éxito. Procesando..."); 
        cargarDatos(); 
      }
    } catch (err) { 
      alert("❌ Error en la conexión con el servidor"); 
    }
  };

  return (
    <div className="pacientes-page fade-in">
      {/* Encabezado con botón de Productividad */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="titulo-pagina" style={{ color: '#fbbf24' }}>Panel de Control Operativo</h2>
        <button 
          onClick={() => navigate("/productividad")}
          style={{ background: '#1e293b', color: '#fbbf24', border: '1px solid #fbbf24', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📊 PANEL DE PRODUCTIVIDAD
        </button>
      </div>

      {/* Toolbar de Acciones */}
      <div className="toolbar-acciones" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input type="file" ref={fileInputRef} style={{ display: "none" }} multiple accept=".dcm" onChange={handleFileChange} />
        <button className="btn-importar-pacs" onClick={handleImportClick} style={{ background: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          📥 IMPORTAR (CD/USB/PC)
        </button>
        <button className="btn-exportar-pacs" onClick={() => alert("Función de exportación activada")} style={{ background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          📤 EXPORTAR SELECCIÓN
        </button>
      </div>

      <Filtros filtros={filtros} setFiltros={setFiltros} tipo="pacientes" />

      <div className="tabla-container glass-box">
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th>ID</th>
              <th>PACIENTE</th>
              <th>MODALIDAD</th>
              <th>FECHA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Esperando datos de modalidades...</td></tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.nombre} {p.apellido}</td>
                  <td>{p.modalidad || 'N/A'}</td>
                  <td>{p.fecha_registro}</td>
                  <td className="acciones">
                    <button className="btn-accion">✉</button>
                    <button className="btn-accion">✎</button>
                    <button className="btn-accion">🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}