import axios from "axios";

const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || window.API_URL || "";
  return `${base}/api/whatsapp`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, "").trim();
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  };
};

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

  const res = await axios.get(`${getApiBase()}/logs?${params.toString()}`, getAuthHeaders());
  return res.data;
};

// ======================================================
//   ENVIAR ESTUDIO POR WHATSAPP
// ======================================================
export const enviarEstudioWhatsApp = async (estudioId, payload) => {
  const res = await axios.post(
    `${getApiBase()}/enviar-estudio/${estudioId}`,
    payload,
    getAuthHeaders()
  );
  return res.data;
};