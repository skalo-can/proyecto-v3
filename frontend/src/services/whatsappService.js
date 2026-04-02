import axios from "axios";

const API = "http://localhost:8000/api/whatsapp";

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

  const res = await axios.get(`${API}/logs?${params.toString()}`);
  return res.data;
};

// ======================================================
//   ENVIAR ESTUDIO POR WHATSAPP  ⭐
// ======================================================
export const enviarEstudioWhatsApp = async (estudioId, payload) => {
  const res = await axios.post(
    `${API}/enviar-estudio/${estudioId}`,
    payload
  );
  return res.data;
};