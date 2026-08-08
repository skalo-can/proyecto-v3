import React, { useState, useEffect } from "react";

export default function GestorFirmas() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [archivoFirma, setArchivoFirma] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 🌐 Ruta relativa para evitar problemas de CORS/Mixed Content en producción
    fetch("/api/usuarios")
      .then(res => res.json())
      .then(data => setUsuarios(data))
      .catch(err => console.error("Error al cargar usuarios:", err));
  }, []);

  const handleSubirFirma = async (e) => {
    e.preventDefault();
    if (!usuarioSeleccionado || !archivoFirma) {
      alert("⚠️ Debe seleccionar un usuario y adjuntar una imagen de firma.");
      return;
    }

    const formData = new FormData();
    formData.append("file", archivoFirma);

    setLoading(true);
    try {
      // 🔥 1. OBTENEMOS EL TOKEN DE SESIÓN GUARDADO
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

      const response = await fetch(`/api/firmas/${usuarioSeleccionado}`, {
        method: "POST",
        body: formData, // Se envía la imagen directamente
        headers: {
          // 🔥 2. INYECTAMOS LA LLAVE DE AUTORIZACIÓN PARA FASTAPI
          "Authorization": token ? `Bearer ${token}` : "" 
        }
      });

      if (!response.ok) throw new Error("No se pudo almacenar la firma");

      alert("✅ Firma guardada y asegurada localmente con éxito.");
      setArchivoFirma(null);
      setUsuarioSeleccionado("");
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const layoutStyle = { width: '100%', minHeight: '100vh', background: '#07080a', padding: '30px', color: '#fff', boxSizing: 'border-box' };
  const cardStyle = { backgroundColor: "#111418", borderRadius: "8px", border: "1px solid #333", padding: "30px", maxWidth: "600px", margin: "0 auto" };
  const inputStyle = { width: "100%", padding: "12px", backgroundColor: "#0f172a", color: "#fff", border: "1px solid #475569", borderRadius: "6px", marginBottom: "20px", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", marginBottom: "8px", color: "#c4b5fd", fontWeight: "bold" };

  return (
    <div style={layoutStyle}>
      <h2 style={{ fontSize: "2rem", marginBottom: "5px" }}>🔒 Módulo de Seguridad: Gestión de Firmas</h2>
      <p style={{ color: "#94a3b8", marginBottom: "30px" }}>Resguarde las firmas digitales localmente en el servidor para los reportes médicos.</p>

      <div style={cardStyle}>
        <form onSubmit={handleSubirFirma}>
          <label style={labelStyle}>Seleccionar Profesional / Administrador</label>
          <select 
            value={usuarioSeleccionado} 
            onChange={(e) => setUsuarioSeleccionado(e.target.value)}
            style={inputStyle}
          >
            <option value="">-- Seleccione un usuario --</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo || u.username} ({u.rol})
              </option>
            ))}
          </select>

          <label style={labelStyle}>Imagen de la Firma (PNG con fondo transparente recomendado)</label>
          <input 
            type="file" 
            accept="image/png, image/jpeg"
            onChange={(e) => setArchivoFirma(e.target.files[0])}
            style={{ ...inputStyle, border: "none", padding: "8px 0" }}
          />

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: "100%", padding: "12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff", border: "none", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Almacenando de forma segura..." : "🛡️ Guardar Firma Localmente"}
          </button>
        </form>
      </div>
    </div>
  );
}