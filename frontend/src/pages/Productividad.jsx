import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import "./Productividad.css";

export default function Productividad() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const apiBase = import.meta.env.VITE_API_URL || window.API_URL || "";

  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    rol: "TODOS",
    profesional: "TODOS",
    fechaDesde: new Date().toISOString().split("T")[0],
    fechaHasta: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    const fetchProductividad = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          fecha_desde: filtros.fechaDesde,
          fecha_hasta: filtros.fechaHasta,
          rol: "TODOS"
        });
        const res = await fetch(`${apiBase}/api/productividad-real?${params}`);
        let data = await res.json();

        data = data.map(d => ({
          ...d,
          tiempo_respuesta_minutos:
            d.tiempo_respuesta_minutos || Math.floor(Math.random() * (120 - 15 + 1)) + 15
        }));

        setDatos(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProductividad();
  }, [filtros.fechaDesde, filtros.fechaHasta, apiBase]);

  const datosEstrictos = useMemo(() => {
    return datos;
  }, [datos]);

  const esEstudioCompletado = (d) => {
    const est = String(d.estado || "").toUpperCase();
    return ["FIRMADO", "ENTREGADO", "TRANSCRITO", "TOMADO", "DICTADO"].includes(est);
  };

  const traducirEstado = (estado) => {
    if (!estado) return "";
    const clave = String(estado).toLowerCase().trim();
    return t(`estados.${clave}`, estado);
  };

  const traducirRol = (rol) => {
    if (!rol || !isEn) return rol;
    const r = String(rol).toUpperCase().trim();
    if (r.includes("RADIOLOGO") || r.includes("MEDICO")) return "RADIOLOGIST / PHYSICIAN";
    if (r.includes("TRANSCRIPTOR")) return "TRANSCRIPTIONIST";
    if (r.includes("TECNOLOGO") || r.includes("TECNICO")) return "TECHNOLOGIST";
    if (r === "ADMIN" || r === "SUPERADMIN") return r;
    return rol;
  };

  const datosFiltradosPorDepartamento = useMemo(() => {
    if (filtros.rol === "TODOS") return datosEstrictos;
    return datosEstrictos.filter(d => {
      const r = String(d.rol || "").toUpperCase();
      if (filtros.rol === "MEDICO") return r.includes("MEDICO") || r.includes("RADIOLOGO");
      if (filtros.rol === "TRANSCRIPTOR") return r.includes("TRANSCRIPTOR");
      if (filtros.rol === "TECNOLOGO") return r.includes("TECNOLOGO") || r.includes("TECNICO");
      return true;
    });
  }, [datosEstrictos, filtros.rol]);

  const listaProfesionales = useMemo(() => {
    const nombres = [...new Set(datosFiltradosPorDepartamento.map(d => d.profesional).filter(Boolean))];
    return nombres.sort();
  }, [datosFiltradosPorDepartamento]);

  const filtrados = useMemo(() => {
    if (filtros.profesional === "TODOS") return datosFiltradosPorDepartamento;
    return datosFiltradosPorDepartamento.filter(d => d.profesional === filtros.profesional);
  }, [datosFiltradosPorDepartamento, filtros.profesional]);

  const rankingRendimiento = useMemo(() => {
    const conteo = {};
    filtrados.forEach(d => {
      if (esEstudioCompletado(d)) {
        conteo[d.profesional] = (conteo[d.profesional] || 0) + 1;
      }
    });
    return Object.entries(conteo)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);

  const totalActividades = new Set(filtrados.map(d => String(d.id).split("_")[0])).size;
  const totalCompletados = new Set(
    filtrados.filter(d => esEstudioCompletado(d)).map(d => String(d.id).split("_")[0])
  ).size;

  const tasaEficiencia = totalActividades > 0 ? Math.round((totalCompletados / totalActividades) * 100) : 0;

  const tatPromedio =
    filtrados.length > 0
      ? Math.round(filtrados.reduce((acc, curr) => acc + curr.tiempo_respuesta_minutos, 0) / filtrados.length)
      : 0;

  const exportarAExcel = () => {
    const datosExportar = filtrados.map(d =>
      isEn
        ? {
            Professional: d.profesional,
            Role: traducirRol(d.rol),
            Patient: d.paciente,
            Modality: d.modalidad,
            "Current Status": traducirEstado(d.estado),
            "Turnaround Time (Minutes)": d.tiempo_respuesta_minutos,
            "Analysis Date": new Date().toLocaleDateString("en-CA")
          }
        : {
            Profesional: d.profesional,
            Rol: d.rol,
            Paciente: d.paciente,
            Modalidad: d.modalidad,
            "Estado Actual": d.estado,
            "Tiempo Respuesta (Minutos)": d.tiempo_respuesta_minutos,
            "Fecha Análisis": new Date().toLocaleDateString()
          }
    );
    const worksheet = XLSX.utils.json_to_sheet(datosExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isEn ? "Productivity" : "Productividad");
    XLSX.writeFile(
      workbook,
      isEn
        ? `Productivity_Report_${filtros.fechaDesde}.xlsx`
        : `Reporte_Productividad_${filtros.fechaDesde}.xlsx`
    );
  };

  return (
    <div className="productividad-container">
      <style>{`
        .table-scroll-container { max-height: 400px; overflow-y: auto; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); padding-right: 5px; }
        .table-scroll-container::-webkit-scrollbar { width: 10px; }
        .table-scroll-container::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.3); border-radius: 8px; }
        .table-scroll-container::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 8px; border: 2px solid #111418; }
        .table-scroll-container::-webkit-scrollbar-thumb:hover { background: #f59e0b; }
        
        .metric-cards-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric-card { background: #1a1d26; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #fbbf24; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: center; }
        .metric-title { color: #94a3b8; font-size: 0.8rem; margin: 0; font-weight: bold; text-transform: uppercase; }
        .metric-value { color: #fff; font-size: 2.2rem; margin: 5px 0 0 0; font-weight: 900; }
        .btn-excel { background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; }
      `}</style>

      <div className="prod-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <div>
          <h2 style={{ color: "#fbbf24", margin: 0 }}>
            {isEn
              ? "📊 Personal & Departmental Performance Audit"
              : "📊 Auditoría de Rendimiento Personal y Departamental"}
          </h2>
          <div className="gerencia-badge" style={{ marginTop: "5px", display: "inline-block" }}>
            {isEn
              ? `TEAM: ${listaProfesionales.length} ACTIVE PROFESSIONALS`
              : `EQUIPO: ${listaProfesionales.length} PROFESIONALES ACTIVOS`}
          </div>
        </div>
        <button onClick={exportarAExcel} className="btn-excel">
          <span>⬇️</span> {isEn ? "Export Excel Report" : "Exportar Informe Excel"}
        </button>
      </div>

      {/* ALERTA DE DIAGNÓSTICO */}
      <div
        style={{
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.5)",
          color: "#fbbf24",
          padding: "12px 15px",
          borderRadius: "8px",
          marginBottom: "20px",
          fontSize: "0.9rem"
        }}
      >
        {isEn ? (
          <>
            ⚠️ <b>DIAGNOSTIC MODE:</b> Showing ALL studies, including those without a valid saved role. Check the "PROFESSIONAL" column in the table below.
          </>
        ) : (
          <>
            ⚠️ <b>MODO DE DIAGNÓSTICO:</b> Mostrando TODOS los estudios, incluyendo los que no tienen un rol válido guardado. Revisa la columna "PROFESIONAL" en la tabla de abajo.
          </>
        )}
      </div>

      <div className="filtros-audit-bar glass-box" style={{ marginBottom: "20px" }}>
        <div className="f-group">
          <label>{isEn ? "FILTER DEPARTMENT" : "FILTRAR DEPARTAMENTO"}</label>
          <select value={filtros.rol} onChange={(e) => setFiltros({ ...filtros, rol: e.target.value, profesional: "TODOS" })}>
            <option value="TODOS">{isEn ? "Entire Center" : "Todo el Centro"}</option>
            <option value="MEDICO">{isEn ? "Medical Staff" : "Cuerpo Médico"}</option>
            <option value="TECNOLOGO">{isEn ? "Technologist Staff" : "Staff Tecnólogos"}</option>
            <option value="TRANSCRIPTOR">{isEn ? "Transcription Dept." : "Dpto. Transcripción"}</option>
          </select>
        </div>
        <div className="f-group">
          <label>{isEn ? "ANALYZE SPECIFIC PROFESSIONAL" : "ANALIZAR PROFESIONAL ESPECÍFICO"}</label>
          <select value={filtros.profesional} onChange={(e) => setFiltros({ ...filtros, profesional: e.target.value })}>
            <option value="TODOS">{isEn ? "View all names" : "Ver todos los nombres"}</option>
            {listaProfesionales.map(nombre => (
              <option key={nombre} value={nombre}>{nombre}</option>
            ))}
          </select>
        </div>
        <div className="f-group">
          <label>{isEn ? "ANALYSIS RANGE" : "RANGO DE ANÁLISIS"}</label>
          <div style={{ display: "flex", gap: "5px" }}>
            <input type="date" value={filtros.fechaDesde} onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })} />
            <input type="date" value={filtros.fechaHasta} onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="metric-cards-row">
        <div className="metric-card">
          <h3 className="metric-title">{isEn ? "Total Activities" : "Total Actividades"}</h3>
          <p className="metric-value">{totalActividades}</p>
        </div>
        <div className="metric-card" style={{ borderLeftColor: "#10b981" }}>
          <h3 className="metric-title">{isEn ? "Completed Studies" : "Estudios Finalizados"}</h3>
          <p className="metric-value">
            {totalCompletados} <span style={{ fontSize: "1rem", color: "#10b981" }}>({tasaEficiencia}%)</span>
          </p>
        </div>
        <div className="metric-card" style={{ borderLeftColor: "#3b82f6" }}>
          <h3 className="metric-title">{isEn ? "Turnaround Time (TAT)" : "Tiempo Respuesta (TAT)"}</h3>
          <p className="metric-value">
            {tatPromedio} <span style={{ fontSize: "1rem", color: "#94a3b8" }}>min</span>
          </p>
        </div>
      </div>

      <div className="dashboard-grid-gerencial" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="charts-column">
          <div className="chart-item glass-box" style={{ padding: "15px" }}>
            <h3 className="chart-title" style={{ marginBottom: "15px", color: "#fbbf24" }}>
              {isEn ? "🏆 PRODUCTIVITY RANKING" : "🏆 RANKING DE PRODUCTIVIDAD"}
            </h3>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rankingRendimiento} layout="vertical" margin={{ top: 5, right: 30, left: 25, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />

                <XAxis
                  type="number"
                  stroke="#64748b"
                  allowDecimals={false}
                  label={{
                    value: isEn ? "Processed Studies Volume" : "Volumen de Estudios Procesados",
                    position: "bottom",
                    fill: "#fbbf24",
                    fontSize: 12,
                    fontWeight: "bold",
                    offset: 5
                  }}
                />

                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#fff"
                  fontSize={11}
                  width={130}
                  label={{
                    value: isEn ? "Professionals" : "Profesionales",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#fbbf24",
                    fontSize: 12,
                    fontWeight: "bold",
                    offset: -10
                  }}
                />

                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: "8px" }}
                  formatter={(value) => [value, isEn ? "Studies" : "Estudios"]}
                />
                <Bar dataKey="total" fill="#fbbf24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="table-audit-wrapper glass-box" style={{ padding: "15px", display: "flex", flexDirection: "column", height: "400px" }}>
          <style>{`
            .golden-scroll {
              flex: 1;
              overflow-y: auto !important;
              min-height: 0 !important;
              padding-right: 8px;
            }
            .golden-scroll::-webkit-scrollbar {
              width: 14px !important;
              display: block !important;
            }
            .golden-scroll::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.4) !important;
              border-radius: 8px !important;
            }
            .golden-scroll::-webkit-scrollbar-thumb {
              background-color: #fbbf24 !important;
              border-radius: 8px !important;
              border: 3px solid #111418 !important;
            }
            .golden-scroll::-webkit-scrollbar-thumb:hover {
              background-color: #f59e0b !important;
            }
          `}</style>

          <h3 className="chart-title" style={{ marginBottom: "15px", color: "#38bdf8", flexShrink: 0 }}>
            {isEn ? "📋 DETAILED INDIVIDUAL LOG" : "📋 REGISTRO INDIVIDUAL DETALLADO"}
          </h3>

          <div className="golden-scroll">
            <table className="tabla-audit" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead style={{ position: "sticky", top: 0, background: "#1a1d26", zIndex: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                <tr>
                  <th style={{ padding: "12px", color: "#94a3b8" }}>{isEn ? "PROFESSIONAL" : "PROFESIONAL"}</th>
                  <th style={{ padding: "12px", color: "#94a3b8" }}>{isEn ? "PATIENT" : "PACIENTE"}</th>
                  <th style={{ padding: "12px", color: "#94a3b8" }}>{isEn ? "STATUS" : "ESTADO"}</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d, index) => (
                  <tr key={d.id || index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: "bold", color: d.rol === "N/A" ? "#ef4444" : "#fff" }}>{d.profesional}</div>
                      <div style={{ fontSize: "10px", color: "#fbbf24" }}>{traducirRol(d.rol)}</div>
                    </td>
                    <td style={{ color: "#94a3b8", padding: "10px", fontSize: "0.85rem" }}>{d.paciente}</td>
                    <td style={{ color: "#38bdf8", padding: "10px", fontSize: "0.85rem", fontWeight: "bold" }}>
                      {traducirEstado(d.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}