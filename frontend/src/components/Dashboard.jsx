import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { generarLinkSeguro } from "../services/secureLinksService";
import { enviarEstudioWhatsApp } from "../services/whatsappService";
import { generarPDFEstudio } from "../services/pdfService";

import {
  getTotalPacientes,
  getTotalEstudios,
  getTotalImagenes,
  getPacientesPorMes,
  getTiposEstudio,
  getActividadSemanal,
} from "../tools/statsService";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Line, Doughnut } from "react-chartjs-2";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const navigate = useNavigate();

  // -----------------------------
  // ESTADOS
  // -----------------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [totalPacientes, setTotalPacientes] = useState(null);
  const [totalEstudios, setTotalEstudios] = useState(null);
  const [totalImagenes, setTotalImagenes] = useState(null);

  const [pacientesMes, setPacientesMes] = useState([]);
  const [tiposEstudio, setTiposEstudio] = useState([]);
  const [actividadSemanalData, setActividadSemanalData] = useState([]);

  // -----------------------------
  // MODALES
  // -----------------------------
  const [modal, setModal] = useState(null);
  const [estudioId, setEstudioId] = useState("");
  const [telefono, setTelefono] = useState("");

  const cerrarModal = () => {
    setModal(null);
    setEstudioId("");
    setTelefono("");
  };

  // -----------------------------
  // HANDLERS
  // -----------------------------
  const enviarLinkSeguroHandler = async () => {
    try {
      const res = await generarLinkSeguro(estudioId);
      alert("Enlace generado:\n" + res.link);
      cerrarModal();
    } catch (error) {
      console.error(error);
      alert("Error generando enlace seguro");
    }
  };

  const enviarWhatsAppHandler = async () => {
    try {
      await enviarEstudioWhatsApp(estudioId, {
        telefono,
        formato: "link",
      });
      alert("Enviado correctamente a " + telefono);
      cerrarModal();
    } catch (error) {
      console.error(error);
      alert("Error enviando por WhatsApp");
    }
  };

  const generarPDFHandler = async () => {
    try {
      const blob = await generarPDFEstudio(estudioId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estudio_${estudioId}.pdf`;
      a.click();
      cerrarModal();
    } catch (error) {
      console.error(error);
      alert("Error generando PDF");
    }
  };

  // -----------------------------
  // CARGA DE DATOS
  // -----------------------------
  useEffect(() => {
    let cancelado = false;

    async function cargarDatos() {
      try {
        setLoading(true);
        setError(null);

        const [p, e, i, pm, te, as] = await Promise.all([
          getTotalPacientes(),
          getTotalEstudios(),
          getTotalImagenes(),
          getPacientesPorMes(),
          getTiposEstudio(),
          getActividadSemanal(),
        ]);

        if (cancelado) return;

        setTotalPacientes(p.total);
        setTotalEstudios(e.total);
        setTotalImagenes(i.total);

        setPacientesMes(pm);
        setTiposEstudio(te);
        setActividadSemanalData(as);
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
        if (!cancelado) setError("No se pudieron cargar las estadísticas.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargarDatos();
    const interval = setInterval(cargarDatos, 30000);

    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, []);

  // -----------------------------
  // LOADER
  // -----------------------------
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Cargando estadísticas clínicas...</p>
      </div>
    );
  }

  // -----------------------------
  // ERROR
  // -----------------------------
  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  // -----------------------------
  // RENDER FINAL — CORRECTO
  // -----------------------------
  return (
    <div className="dashboard-wrapper">

      <h1 className="dashboard-title glass-title">Panel Clínico MI_PACS</h1>

      {/* Tarjetas estadísticas */}
      <div className="stats-grid">
        <Card title="Pacientes registrados" value={totalPacientes ?? 0} />
        <Card title="Estudios procesados" value={totalEstudios ?? 0} />
        <Card title="Imágenes almacenadas" value={totalImagenes ?? 0} />
      </div>

      {/* Gráficas */}
      <div className="charts-grid">
        <GraphCard title="Pacientes nuevos por mes">
          {pacientesMes.length === 0 ? (
            <p className="no-data">Sin datos disponibles</p>
          ) : (
            <Bar data={pacientesPorMesChart} />
          )}
        </GraphCard>

        <GraphCard title="Distribución por tipo de estudio">
          {tiposEstudio.length === 0 ? (
            <p className="no-data">Sin datos disponibles</p>
          ) : (
            <Doughnut data={estudiosPorTipoChart} />
          )}
        </GraphCard>

        <GraphCard title="Actividad semanal del PACS">
          {actividadSemanalData.length === 0 ? (
            <p className="no-data">Sin datos disponibles</p>
          ) : (
            <Line data={actividadSemanalChart} />
          )}
        </GraphCard>
      </div>

    </div>
  );

  // -----------------------------
  // COMPONENTES AUXILIARES
  // -----------------------------
  function Card({ title, value }) {
    return (
      <div className="card fade-in glass-box">
        <h3 className="card-title">{title}</h3>
        <p className="card-value">{value}</p>
      </div>
    );
  }

  function GraphCard({ title, children }) {
    return (
      <div className="graph-card fade-in glass-box">
        <h2 className="graph-title">{title}</h2>
        {children}
      </div>
    );
  }
}