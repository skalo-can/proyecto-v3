import axios from "axios";

// ✅ Ruta relativa
const API = "/api/whatsapp";

// ======================================================
//   LISTAR LOGS (con filtros y paginación)
// ======================================================
export const listarWhatsAppLogs = async ({
  telefono = "",
  fechaDesde = "",
  fechaHasta = "",
  page = 1,
  pageSize = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (telefono) params.append("telefono", telefono);
  if (fechaDesde) params.append("fecha_desde", fechaDesde);
  if (fechaHasta) params.append("fecha_hasta", fechaHasta);
  params.append("page", page);
  params.append("page_size", pageSize);

  // 🛡️ OBTENEMOS EL TOKEN DE SEGURIDAD DEL NAVEGADOR
  const rawToken = localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, ''); // Limpiamos comillas extra

  // 🚀 INYECTAMOS EL TOKEN EN LOS HEADERS
  const res = await axios.get(`${API}/logs?${params.toString()}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  
  return res.data;
};

// ======================================================
//   ENVIAR ESTUDIO POR WHATSAPP  ⭐
// ======================================================
export const enviarEstudioWhatsApp = async (estudioId, payload) => {
  // 🛡️ OBTENEMOS EL TOKEN DE SEGURIDAD
  const rawToken = localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, '');

  // 🚀 INYECTAMOS EL TOKEN EN LOS HEADERS
  const res = await axios.post(
    `${API}/enviar-estudio/${estudioId}`,
    payload,
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );
  
  return res.data;
};