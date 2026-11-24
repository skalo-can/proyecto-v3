import axios from "axios";

const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || window.API_URL || "";
  return `${base}/api/secure-links`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, "").trim();
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  };
};

// Rutas protegidas (requieren sesión activa en MI_PACS)
export const generarLinkSeguro = async (estudioId) => {
  const res = await axios.post(`${getApiBase()}/generar/${estudioId}`, {}, getAuthHeaders());
  return res.data;
};

export const revocarLinkSeguro = async (token) => {
  const res = await axios.post(`${getApiBase()}/revocar/${token}`, {}, getAuthHeaders());
  return res.data;
};

export const listarEnlacesSeguros = async () => {
  const res = await axios.get(`${getApiBase()}/listar`, getAuthHeaders());
  return res.data;
};

// Rutas públicas (acceso directo del paciente mediante token en URL)
export const validarLinkSeguro = async (token) => {
  const res = await axios.get(`${getApiBase()}/validar/${token}`);
  return res.data;
};

export const descargarPorToken = async (token) => {
  const res = await axios.get(`${getApiBase()}/descargar/${token}`, {
    responseType: "blob",
  });
  return res.data;
};