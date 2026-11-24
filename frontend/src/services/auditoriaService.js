import axios from "axios";

const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || window.API_URL || "";
  return `${base}/api/auditoria`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, "").trim();
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  };
};

export const listarAuditoria = async (limit = 100) => {
  const res = await axios.get(`${getApiBase()}/listar?limit=${limit}`, getAuthHeaders());
  return res.data;
};

export const auditoriaPorEstudio = async (estudioId) => {
  const res = await axios.get(`${getApiBase()}/estudio/${estudioId}`, getAuthHeaders());
  return res.data;
};

export const auditoriaPorUsuario = async (usuarioId) => {
  const res = await axios.get(`${getApiBase()}/usuario/${usuarioId}`, getAuthHeaders());
  return res.data;
};