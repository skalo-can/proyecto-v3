import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function GestorFirmas() {
  const { t } = useTranslation();
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
      alert(t('firmas.alerta_obligatorio'));
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

      alert(t('firmas.alerta_exito'));
      setArchivoFirma(null);
      setUsuarioSeleccionado("");
    } catch (error) {
      alert(t('firmas.alerta_error') + error.message);
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
      <h2 style={{ fontSize: "2rem", marginBottom: "5px" }}>{t('firmas.titulo')}</h2>
      <p style={{ color: "#94a3b8", marginBottom: "30px" }}>{t('firmas.subtitulo')}</p>

      <div style={cardStyle}>
        <form onSubmit={handleSubirFirma}>
          <label style={labelStyle}>{t('firmas.seleccionar_profesional')}</label>
          <select 
            value={usuarioSeleccionado} 
            onChange={(e) => setUsuarioSeleccionado(e.target.value)}
            style={inputStyle}
          >
            <option value="">{t('firmas.placeholder_usuario')}</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre_completo || u.username} ({u.rol})
              </option>
            ))}
          </select>

          <label style={labelStyle}>{t('firmas.imagen_firma')}</label>
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
            {loading ? t('firmas.btn_guardando') : t('firmas.btn_guardar')}
          </button>
        </form>
      </div>
    </div>
  );
}