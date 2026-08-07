import axios from "axios";

// ✅ Usamos ruta relativa para que el proxy de Vite y Ngrok hagan su magia
const API = "/api/secure-links";

export const generarLinkSeguro = async (estudioId) => {
  const res = await axios.post(`${API}/generar/${estudioId}`);
  return res.data;
};

export const validarLinkSeguro = async (token) => {
  const res = await axios.get(`${API}/validar/${token}`);
  return res.data;
};

export const descargarPorToken = async (token) => {
  const res = await axios.get(`${API}/descargar/${token}`, {
    responseType: "blob",
  });
  return res.data;
};

export const revocarLinkSeguro = async (token) => {
  const res = await axios.post(`${API}/revocar/${token}`);
  return res.data;
};

export const listarEnlacesSeguros = async () => {
  const res = await axios.get(`${API}/listar`);
  return res.data;
};