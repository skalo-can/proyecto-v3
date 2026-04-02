import axios from "axios";

const API = "http://localhost:8000/api/pdf";

export const generarPDFEstudio = async (estudioId) => {
  const res = await axios.get(`${API}/estudio/${estudioId}`, {
    responseType: "blob",
  });
  return res.data;
};