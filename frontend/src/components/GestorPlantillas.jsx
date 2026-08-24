import React, { useState, useEffect } from "react";

export default function GestorPlantillas() {
  const [plantillas, setPlantillas] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formData, setFormData] = useState({
    nombre: "",
    modalidad: "CR",
    medico_id: "",
    contenido: ""
  });

  const cargarPlantillas = async () => {
    try {
      const response = await fetch("http://192.168.5.21:8000/api/plantillas");
      if (response.ok) {
        const data = await response.json();
        setPlantillas(data);
      }
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
    }
  };

  const cargarMedicos = async () => {
    try {
      const response = await fetch("http://192.168.5.21:8000/api/usuarios");
      if (response.ok) {
        const data = await response.json();
        const listaMedicos = data.filter(u => u.rol && u.rol.toLowerCase().includes('radiologo'));
        setMedicos(listaMedicos);
      }
    } catch (error) {
      console.error("Error al cargar la lista de radiólogos:", error);
    }
  };

  useEffect(() => {
    cargarPlantillas();
    cargarMedicos();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditar = (plantilla) => {
    setFormData({
      nombre: plantilla.nombre,
      modalidad: plantilla.modalidad || "CR",
      medico_id: plantilla.medico_id || "",
      contenido: plantilla.contenido
    });
    setEditId(plantilla.id);
    setIsEditing(true);
  };

  const cancelarEdicion = () => {
    setFormData({ nombre: "", modalidad: "CR", medico_id: "", contenido: "" });
    setEditId(null);
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.contenido) {
      alert("⚠️ El nombre y el contenido son obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        medico_id: formData.medico_id ? parseInt(formData.medico_id) : null
      };

      const url = isEditing 
        ? `http://192.168.5.21:8000/api/plantillas/${editId}` 
        : "http://192.168.5.21:8000/api/plantillas";
        
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Fallo al guardar la plantilla");

      alert(`✅ Plantilla ${isEditing ? 'actualizada' : 'creada'} exitosamente`);
      
      cancelarEdicion();
      cargarPlantillas();
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("⚠️ ¿Estás seguro de que deseas eliminar esta plantilla de forma permanente?")) return;
    try {
      const response = await fetch(`http://192.168.5.21:8000/api/plantillas/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar la plantilla");
      cargarPlantillas();
    } catch (error) {
      alert("❌ Error: " + error.message);
    }
  };

  // 🌟 1. CONTENEDOR PRINCIPAL: height: 100% para encajar perfecto en tu App.jsx
  const layoutStyle = { 
    width: '100%', 
    height: '100%', 
    background: '#07080a', 
    padding: '20px 30px', 
    color: '#fff', 
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column'
  };
  
  // 🌟 2. TARJETA BASE
  const cardStyle = { 
    backgroundColor: "#111418", 
    borderRadius: "8px", 
    border: "1px solid #333", 
    padding: "20px", 
    display: "flex", 
    flexDirection: "column", 
    boxSizing: "border-box" 
  };
  
  const inputStyle = { width: "100%", padding: "10px", backgroundColor: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "6px", marginBottom: "12px", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", marginBottom: "6px", color: "#c4b5fd", fontWeight: "bold", fontSize: "0.9rem" };
  
  const btnSubmitStyle = { padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", color: "#fff", border: "none", background: isEditing ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" };
  const btnCancelStyle = { padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", background: "#334155", color: "#fff", border: "none" };

  return (
    <div style={layoutStyle}>
      <style>
        {`
          .scroll-dorado::-webkit-scrollbar {
            width: 8px;
          }
          .scroll-dorado::-webkit-scrollbar-track {
            background: #0f172a;
            border-radius: 4px;
          }
          .scroll-dorado::-webkit-scrollbar-thumb {
            background: #fbbf24;
            border-radius: 4px;
            border: 1px solid #1e293b;
          }
          .scroll-dorado::-webkit-scrollbar-thumb:hover {
            background: #f59e0b;
          }
        `}
      </style>

      {/* TÍTULO FIJO */}
      <div style={{ flexShrink: 0, marginBottom: "15px" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "4px" }}>📚 Gestor de Plantillas Médicas</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>Cree, edite o elimine los formatos predeterminados para los radiólogos.</p>
      </div>

      {/* 🌟 3. FILA CONTENEDORA: minHeight: 0 obliga a Flexbox a no salirse de la pantalla */}
      <div style={{ display: "flex", gap: "25px", flex: 1, minHeight: 0 }}>
        
        {/* TARJETA IZQUIERDA: FORMULARIO */}
        <div style={{ ...cardStyle, flex: "1 1 400px", border: isEditing ? "1px solid #f59e0b" : "1px solid #333", minHeight: 0, overflowY: "auto" }} className="scroll-dorado">
          <h3 style={{ borderBottom: "1px solid #333", paddingBottom: "8px", marginBottom: "15px", color: isEditing ? "#fcd34d" : "#fff", fontSize: "1.1rem", flexShrink: 0 }}>
            {isEditing ? "✏️ Editar Plantilla" : "✨ Nueva Plantilla"}
          </h3>
          
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <label style={labelStyle}>Nombre descriptivo</label>
            <input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Tórax Normal Dr. Diaz" style={inputStyle} />

            <div style={{ display: "flex", gap: "15px", flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Modalidad</label>
                <select name="modalidad" value={formData.modalidad} onChange={handleChange} style={inputStyle}>
                  <option value="CR">CR - Rayos X</option>
                  <option value="CT">CT - Tomografía</option>
                  <option value="MR">MR - Resonancia</option>
                  <option value="US">US - Ultrasonido</option>
                  <option value="MG">MG - Mamografía</option>
                  <option value="DX">DX - Radiografía Digital</option>
                  <option value="DXA">DXA - Densitometría Ósea</option>
                  <option value="PT">PT - PET SCAN</option>
                  <option value="RF">RF - Fluoroscopía</option>
                  <option value="XA">XA - Angiografía</option>
                </select>
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Radiólogo Asignado</label>
                <select name="medico_id" value={formData.medico_id} onChange={handleChange} style={inputStyle}>
                  <option value="">🌍 Plantilla Global (Todos)</option>
                  {medicos.map(medico => (
                    <option key={medico.id} value={medico.id}>👨‍⚕️ {medico.nombre_completo || medico.username}</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={labelStyle}>Contenido de la Plantilla</label>
            <textarea 
              name="contenido" 
              value={formData.contenido} 
              onChange={handleChange} 
              placeholder="TÉCNICA: ...&#10;HALLAZGOS: ...&#10;CONCLUSIÓN: ..." 
              style={{ ...inputStyle, flex: 1, minHeight: "150px", resize: "vertical", fontFamily: "monospace", fontSize: "13px" }} 
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexShrink: 0 }}>
              <button type="submit" disabled={loading} style={{ ...btnSubmitStyle, flex: 1, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Guardando..." : (isEditing ? "💾 Actualizar Plantilla" : "💾 Guardar Plantilla")}
              </button>
              {isEditing && (
                <button type="button" onClick={cancelarEdicion} style={btnCancelStyle}>
                  ❌ Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 🌟 4. TARJETA DERECHA: minHeight: 0 transfiere el límite a su hijo */}
        <div style={{ ...cardStyle, flex: "2 1 500px", minHeight: 0 }}>
          <h3 style={{ borderBottom: "1px solid #333", paddingBottom: "8px", marginBottom: "15px", flexShrink: 0, fontSize: "1.1rem" }}>
            📋 Plantillas Existentes ({plantillas.length})
          </h3>
          
          {/* 🌟 5. EL HIJO SCROLLABLE: Al estar en una cadena ininterrumpida de minHeight: 0, por fin activa el scroll */}
          <div className="scroll-dorado" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "5px" }}>
            {plantillas.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No hay plantillas registradas aún.</p>
            ) : (
              plantillas.map(p => {
                const medicoAsignado = medicos.find(m => m.id === p.medico_id);
                const nombreMedico = medicoAsignado ? (medicoAsignado.nombre_completo || medicoAsignado.username) : "Global";

                return (
                  <div key={p.id} style={{ backgroundColor: "#1e293b", padding: "12px 15px", borderRadius: "6px", marginBottom: "10px", borderLeft: "4px solid #8b5cf6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "1rem", color: "#f8fafc" }}>{p.nombre}</strong>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ backgroundColor: "#0f172a", border: "1px solid #334155", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "#38bdf8" }}>
                          👨‍⚕️ {nombreMedico}
                        </span>
                        <span style={{ backgroundColor: "#334155", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "#fbbf24", fontWeight: "bold" }}>
                          {p.modalidad}
                        </span>
                        
                        <button 
                          onClick={() => handleEditar(p)}
                          style={{ background: "transparent", border: "none", color: "#facc15", cursor: "pointer", fontSize: "1.1rem", padding: "0 4px" }}
                          title="Editar Plantilla"
                        >
                          ✏️
                        </button>

                        <button 
                          onClick={() => handleEliminar(p.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "0 4px" }}
                          title="Eliminar Plantilla"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "0.85rem", whiteSpace: "pre-wrap", backgroundColor: "#0f172a", padding: "8px", borderRadius: "4px", maxHeight: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.contenido}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}