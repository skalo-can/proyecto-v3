const API_URL = "http://192.168.5.21:8000/api/stats";

/* ---------------------------------------------------------
   WRAPPER PROFESIONAL PARA FETCH
--------------------------------------------------------- */
async function fetchSeguro(url, opciones = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const res = await fetch(url, {
      ...opciones,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}`);
    }

    // Validar JSON seguro
    const data = await res.json().catch(() => {
      throw new Error("Respuesta JSON inválida");
    });

    return data;

  } catch (error) {
    clearTimeout(timeout);
    console.error("Error en fetchSeguro:", error.message);
    throw error;
  }
}

/* ---------------------------------------------------------
   ENDPOINTS DE ESTADÍSTICAS
--------------------------------------------------------- */

export function getTotalPacientes() {
  return fetchSeguro(`${API_URL}/pacientes`);
}

export function getTotalEstudios() {
  return fetchSeguro(`${API_URL}/estudios`);
}

export function getTotalImagenes() {
  return fetchSeguro(`${API_URL}/imagenes`);
}

export function getPacientesPorMes() {
  return fetchSeguro(`${API_URL}/pacientes_por_mes`);
}

export function getTiposEstudio() {
  return fetchSeguro(`${API_URL}/tipos_estudio`);
}

export function getActividadSemanal() {
  return fetchSeguro(`${API_URL}/actividad_semanal`);
}