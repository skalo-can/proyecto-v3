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
  const pacientesPorMes = {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
    datasets: [
      {
        label: "Pacientes nuevos",
        data: [22, 35, 40, 28, 50, 62],
        backgroundColor: "#0ea5e9",
      },
    ],
  };

  const estudiosPorTipo = {
    labels: ["Rayos X", "TAC", "RM", "Ecografía"],
    datasets: [
      {
        label: "Estudios",
        data: [120, 80, 45, 60],
        backgroundColor: ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc"],
      },
    ],
  };

  const actividadSemanal = {
    labels: ["Lun", "Mar", "Mié", "Jue", "Vie"],
    datasets: [
      {
        label: "Estudios procesados",
        data: [32, 45, 28, 50, 62],
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.2)",
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Panel Clínico MI_PACS</h1>

      {/* Tarjetas estadísticas */}
      <div className="stats-grid">
        <Card title="Pacientes registrados" value="128" />
        <Card title="Estudios procesados" value="342" />
        <Card title="Imágenes almacenadas" value="5,120" />
      </div>

      {/* Gráficas */}
      <div className="charts-grid">
        <GraphCard title="Pacientes nuevos por mes">
          <Bar data={pacientesPorMes} />
        </GraphCard>

        <GraphCard title="Distribución por tipo de estudio">
          <Doughnut data={estudiosPorTipo} />
        </GraphCard>

        <GraphCard title="Actividad semanal del PACS">
          <Line data={actividadSemanal} />
        </GraphCard>
      </div>
    </div>
  );
}

/* COMPONENTES AUXILIARES */

function Card({ title, value }) {
  return (
    <div className="card">
      <h3 className="card-title">{title}</h3>
      <p className="card-value">{value}</p>
    </div>
  );
}

function GraphCard({ title, children }) {
  return (
    <div className="graph-card">
      <h2 className="graph-title">{title}</h2>
      {children}
    </div>
  );
}