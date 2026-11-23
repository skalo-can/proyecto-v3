import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

export default function GestorPlantillas() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const apiBase =
    window.API_URL ||
    (window.location.origin.includes(":5173")
      ? "http://192.168.5.21:8000"
      : window.location.origin);

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

  const getAuthHeaders = (includeJson = false) => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
    const headers = {};
    if (includeJson) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  const cargarPlantillas = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/plantillas`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setPlantillas(data);
      }
    } catch (error) {
      console.error("Error al cargar plantillas:", error);
    }
  }, [apiBase]);

  const cargarMedicos = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/usuarios`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const listaMedicos = data.filter(u => u.rol && u.rol.toLowerCase().includes("radiologo"));
        setMedicos(listaMedicos);
      }
    } catch (error) {
      console.error("Error al cargar la lista de radiólogos:", error);
    }
  }, [apiBase]);

  useEffect(() => {
    cargarPlantillas();
    cargarMedicos();
  }, [cargarPlantillas, cargarMedicos]);

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
      alert(t("plantillas.alerta_obligatorio"));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        medico_id: formData.medico_id ? parseInt(formData.medico_id) : null
      };

      const url = isEditing
        ? `${apiBase}/api/plantillas/${editId}`
        : `${apiBase}/api/plantillas`;

      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(isEn ? "Failed to save template" : "Fallo al guardar la plantilla");
      }

      alert(isEditing ? t("plantillas.alerta_actualizada") : t("plantillas.alerta_creada"));

      cancelarEdicion();
      cargarPlantillas();
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm(t("plantillas.alerta_eliminar"))) return;
    try {
      const response = await fetch(`${apiBase}/api/plantillas/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(isEn ? "Could not delete template" : "No se pudo eliminar la plantilla");
      }
      cargarPlantillas();
    } catch (error) {
      alert("❌ Error: " + error.message);
    }
  };

  const layoutStyle = {
    width: "100%",
    height: "100%",
    background: "#07080a",
    padding: "20px 30px",
    color: "#fff",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column"
  };

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
          .scroll-dorado::-webkit-scrollbar { width: 8px; }
          .scroll-dorado::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
          .scroll-dorado::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 4px; border: 1px solid #1e293b; }
          .scroll-dorado::-webkit-scrollbar-thumb:hover { background: #f59e0b; }
        `}
      </style>

      <div style={{ flexShrink: 0, marginBottom: "15px" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "4px" }}>{t("plantillas.titulo")}</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>{t("plantillas.subtitulo")}</p>
      </div>

      <div style={{ display: "flex", gap: "25px", flex: 1, minHeight: 0 }}>
        <div style={{ ...cardStyle, flex: "1 1 400px", border: isEditing ? "1px solid #f59e0b" : "1px solid #333", minHeight: 0, overflowY: "auto" }} className="scroll-dorado">
          <h3 style={{ borderBottom: "1px solid #333", paddingBottom: "8px", marginBottom: "15px", color: isEditing ? "#fcd34d" : "#fff", fontSize: "1.1rem", flexShrink: 0 }}>
            {isEditing ? t("plantillas.editar_plantilla") : t("plantillas.nueva_plantilla")}
          </h3>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <label style={labelStyle}>{t("plantillas.nombre_descriptivo")}</label>
            <input name="nombre" value={formData.nombre} onChange={handleChange} placeholder={t("plantillas.placeholder_nombre")} style={inputStyle} />

            <div style={{ display: "flex", gap: "15px", flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t("plantillas.modalidad")}</label>
                <select name="modalidad" value={formData.modalidad} onChange={handleChange} style={inputStyle}>
                  <option value="CR">{isEn ? "CR - X-Ray" : "CR - Rayos X"}</option>
                  <option value="CT">{isEn ? "CT - Computed Tomography" : "CT - Tomografía"}</option>
                  <option value="MR">{isEn ? "MR - Magnetic Resonance" : "MR - Resonancia"}</option>
                  <option value="US">{isEn ? "US - Ultrasound" : "US - Ultrasonido"}</option>
                  <option value="MG">{isEn ? "MG - Mammography" : "MG - Mamografía"}</option>
                  <option value="DX">{isEn ? "DX - Digital Radiography" : "DX - Radiografía Digital"}</option>
                  <option value="DXA">{isEn ? "DXA - Bone Densitometry" : "DXA - Densitometría Ósea"}</option>
                  <option value="PT">{isEn ? "PT - PET Scan" : "PT - PET SCAN"}</option>
                  <option value="RF">{isEn ? "RF - Fluoroscopy" : "RF - Fluoroscopía"}</option>
                  <option value="XA">{isEn ? "XA - Angiography" : "XA - Angiografía"}</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t("plantillas.radiologo_asignado")}</label>
                <select name="medico_id" value={formData.medico_id} onChange={handleChange} style={inputStyle}>
                  <option value="">{t("plantillas.plantilla_global")}</option>
                  {medicos.map(medico => (
                    <option key={medico.id} value={medico.id}>👨‍⚕️ {medico.nombre_completo || medico.username}</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={labelStyle}>{t("plantillas.contenido_plantilla")}</label>
            <textarea
              name="contenido"
              value={formData.contenido}
              onChange={handleChange}
              placeholder={t("plantillas.placeholder_contenido")}
              style={{ ...inputStyle, flex: 1, minHeight: "150px", resize: "vertical", fontFamily: "monospace", fontSize: "13px" }}
            />

            <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexShrink: 0 }}>
              <button type="submit" disabled={loading} style={{ ...btnSubmitStyle, flex: 1, opacity: loading ? 0.7 : 1 }}>
                {loading ? t("plantillas.btn_guardando") : (isEditing ? t("plantillas.btn_actualizar") : t("plantillas.btn_guardar"))}
              </button>
              {isEditing && (
                <button type="button" onClick={cancelarEdicion} style={btnCancelStyle}>
                  {t("plantillas.btn_cancelar")}
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ ...cardStyle, flex: "2 1 500px", minHeight: 0 }}>
          <h3 style={{ borderBottom: "1px solid #333", paddingBottom: "8px", marginBottom: "15px", flexShrink: 0, fontSize: "1.1rem" }}>
            {t("plantillas.plantillas_existentes")} ({plantillas.length})
          </h3>

          <div className="scroll-dorado" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "5px" }}>
            {plantillas.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>{t("plantillas.sin_plantillas")}</p>
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
                          title={isEn ? "Edit Template" : "Editar Plantilla"}
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => handleEliminar(p.id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "0 4px" }}
                          title={isEn ? "Delete Template" : "Eliminar Plantilla"}
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