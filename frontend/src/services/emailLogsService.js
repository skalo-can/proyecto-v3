import axios from "axios";

const API = "http://localhost:8000/api/email-logs";

export const listarEmailLogs = async (limit = 100) => {
  const res = await axios.get(`${API}/listar?limit=${limit}`);
  return res.data;
};

export const emailLogsPorEstudio = async (estudioId) => {
  const res = await axios.get(`${API}/estudio/${estudioId}`);
  return res.data;
};

export const emailLogsPorEmail = async (email) => {
  const res = await axios.get(`${API}/email/${email}`);
  return res.data;
};