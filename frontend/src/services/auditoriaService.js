import axios from "axios";

const API = "http://192.168.5.21:8000/api/auditoria";

export const listarAuditoria = async (limit = 100) => {
  const res = await axios.get(`${API}/listar?limit=${limit}`);
  return res.data;
};

export const auditoriaPorEstudio = async (estudioId) => {
  const res = await axios.get(`${API}/estudio/${estudioId}`);
  return res.data;
};

export const auditoriaPorUsuario = async (usuarioId) => {
  const res = await axios.get(`${API}/usuario/${usuarioId}`);
  return res.data;
};