import axios from "axios";

const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || window.API_URL || "";
  return `${base}/api/email-logs`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, "").trim();
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  };
};

export const listarEmailLogs = async (limit = 100) => {
  const res = await axios.get(`${getApiBase()}/listar?limit=${limit}`, getAuthHeaders());
  return res.data;
};

export const emailLogsPorEstudio = async (estudioId) => {
  const res = await axios.get(`${getApiBase()}/estudio/${estudioId}`, getAuthHeaders());
  return res.data;
};

export const emailLogsPorEmail = async (email) => {
  const res = await axios.get(`${getApiBase()}/email/${encodeURIComponent(email)}`, getAuthHeaders());
  return res.data;
};