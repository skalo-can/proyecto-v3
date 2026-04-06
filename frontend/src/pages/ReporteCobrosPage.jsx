import { useEffect, useState } from "react";
import "./ReporteCobrosPage.css";

export default function ReporteCobrosPage() {
  const [datos, setDatos] = useState({
    totalPacientes: 0,
    totalEstudios: 0,
    imagenesAlmacenadas: 0
  });

  return (
    <div className="cobros-container">
      {/* Título principal fijo */}
      <h1 className="cobros-title">Reporte de Cobros</h1>

      {/* Bloque interno con el fondo oscuro y scroll */}
      <div className="cobros-card">
        
        {/* FILTROS */}
        <div className="cobros-section">
          <h3 className="section-label">🔍 Filtro de Consumo por Periodo</h3>
          <div className="filtros-row">
            <input type="date" className="pacs-input" />
            <input type="date" className="pacs-input" />
            <button className="pacs-btn-gold">Calcular</button>
          </div>
        </div>

        {/* INDICADORES (Mini Tarjetas) */}
        <div className="cobros-stats-grid">
          <div className="mini-stat-card">
            <span className="stat-desc">Total Pacientes</span>
            <h2 className="stat-number">{datos.totalPacientes}</h2>
          </div>
          <div className="mini-stat-card">
            <span className="stat-desc">Total Estudios</span>
            <h2 className="stat-number">{datos.totalEstudios}</h2>
          </div>
          <div className="mini-stat-card">
            <span className="stat-desc">Imágenes Almacenadas</span>
            <h2 className="stat-number">{datos.imagenesAlmacenadas}</h2>
          </div>
        </div>

        {/* DETALLES Y GRÁFICO */}
        <div className="cobros-details-grid">
          <div className="detail-box">
            <h3 className="section-label">Distribución de Modalidades (%)</h3>
            <div className="placeholder-content">Cargando gráfico...</div>
          </div>
          <div className="detail-box">
            <h3 className="section-label">Detalle de Valores</h3>
            <table className="cobros-table">
              <thead>
                <tr>
                  <th>Modalidad</th>
                  <th>Cantidad</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="3" className="no-data-msg">Sin registros en este rango</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button className="volver-btn" onClick={() => window.history.back()}>
        ⬅ Volver
      </button>
    </div>
  );
}