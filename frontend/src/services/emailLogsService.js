import axios from "axios";

// Es mejor usar window.location.origin o una variable de entorno para que sea dinámico
// pero mantendré tu IP temporalmente si estás probando en red local.
const API = "http://192.168.5.21:8000/api/email-logs"; 

// Función de ayuda para obtener el token limpio
const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/['"]+/g, '');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

export const listarEmailLogs = async (limit = 100) => {
  // Le pasamos los headers con el token como segundo parámetro a axios.get
  const res = await axios.get(`${API}/listar?limit=${limit}`, getAuthHeaders());
  return res.data;
};

export const emailLogsPorEstudio = async (estudioId) => {
  const res = await axios.get(`${API}/estudio/${estudioId}`, getAuthHeaders());
  return res.data;
};

export const emailLogsPorEmail = async (email) => {
  const res = await axios.get(`${API}/email/${email}`, getAuthHeaders());
  return res.data;
};