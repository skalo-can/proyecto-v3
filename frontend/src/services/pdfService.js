import axios from "axios";

const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || window.API_URL || "";
  return `${base}/api/pdf`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  const token = rawToken.replace(/['"]+/g, "").trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const generarPDFEstudio = async (estudioId) => {
  const res = await axios.get(`${getApiBase()}/estudio/${estudioId}`, {
    responseType: "blob",
    headers: getAuthHeaders(),
  });
  return res.data;
};