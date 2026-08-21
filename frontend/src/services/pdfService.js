import axios from "axios";

const API = "http://192.168.5.21:8000/api/pdf";

export const generarPDFEstudio = async (estudioId) => {
  const res = await axios.get(`${API}/estudio/${estudioId}`, {
    responseType: "blob",
  });
  return res.data;
};