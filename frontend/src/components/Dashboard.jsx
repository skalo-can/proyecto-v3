import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
// ... (tus otros imports de gráficas y servicios)

export default function Dashboard() {
  const { user } = useAuth();
  // El token suele guardarse en el login, si useAuth no lo expone lo leemos de localStorage
  const token = user?.token || localStorage.getItem("token"); 
  
  const isSkalo = user?.username === "SKALO" || user?.rol === "superadmin";
  const puedeImportar = user?.rol === "admin" || user?.rol === "tecnico" || isSkalo;

  // Estados para tus filtros avanzados (Nombre, ID, Modalidad, Estado)
  const [filtro, setFiltro] = useState({ texto: "", estado: "todos" });
  
  // 🚀 NUEVO: Estado de bloqueo visual para evitar múltiples clics concurrentes en el disco duro
  const [cargandoImportacion, setCargandoImportacion] = useState(false);

  // 🚀 NUEVA: Función de conexión directa con la API de inyección masiva de eFilm
  const handleImportarDiscoExterno = async () => {
    const rutaDisco = window.prompt(
      "📁 Inyección de Historial Clínico (Merge eFilm)\n\nPor favor, introduzca la ruta absoluta de la carpeta en su disco externo:", 
      "H:\\Abril_2020"
    );

    // Si el usuario cancela la alerta o la deja vacía, se interrumpe la ejecución de forma segura
    if (!rutaDisco) return;

    setCargandoImportacion(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/import/disco-externo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ruta_carpeta: rutaDisco })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`🚀 ¡Inyección Iniciada!\n\n${data.message}\n\nEl sistema indexará las tomografías y Rayos X (CR) de fondo. Ajuste el calendario al año 2020 en el panel operativo para visualizarlos.`);
      } else {
        alert(`❌ Error del Servidor: ${data.detail || "No se pudo procesar la ruta."}`);
      }
    } catch (error) {
      alert("❌ Error de red: El servidor de MI_PACS no responde. Verifique que Uvicorn esté activo.");
    } finally {
      setCargandoImportacion(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <h1 className="dashboard-title glass-title">Panel de Control MI_PACS</h1>

      {/* BARRA DE BÚSQUEDA INTEGRADA Y BOTÓN AZUL OPERATIVO */}
      <div className="search-bar-container glass-box" style={{ display: "flex", gap: "15px", alignItems: "center" }}>
        <input 
          type="text" 
          placeholder="Buscar por Nombre, ID, Modalidad..." 
          className="dashboard-input"
          style={{ flex: 2 }}
          onChange={(e) => setFiltro({...filtro, texto: e.target.value})}
        />
        <select className="dashboard-select" style={{ flex: 1 }} onChange={(e) => setFiltro({...filtro, estado: e.target.value})}>
          <option value="todos">Todos los Estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Leído">Leído</option>
          <option value="Entregado">Entregado</option>
          <option value="Terminado">Terminado</option>
        </select>

        {/* 🚀 NUEVO: El Botón Azul dinámico conectado al backend (Visible solo para staff autorizado) */}
        {puedeImportar && (
          <button 
            className="btn-importar-azul"
            onClick={handleImportarDiscoExterno}
            disabled={cargandoImportacion}
            style={{
              background: "#0284c7",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: cargandoImportacion ? "not-allowed" : "pointer",
              opacity: cargandoImportacion ? 0.6 : 1,
              whiteSpace: "nowrap",
              transition: "all 0.3s"
            }}
          >
            {cargandoImportacion ? "⏳ Analizando eFilm..." : "📦 Importar desde archivo"}
          </button>
        )}
      </div>

      <div style={{ marginTop: "20px" }} className="stats-grid">
        <div className="card"><h3>Pacientes</h3><p>120</p></div>
        <div className="card"><h3>Estudios</h3><p>450</p></div>
        
        {/* 🔐 ESTA TARJETA SOLO SE VE EN LA FOTO 31 (MASTER) */}
        {isSkalo && (
          <div className="card card-master-danger">
            <h3 style={{ color: '#ff4d4d' }}>Zona Maestra</h3>
            <button className="btn-reset-danger" onClick={() => {/* tu lógica de reset */}}>
              ⚠️ RESETEAR BASE DE DATOS
            </button>
          </div>
        )}
      </div>

      {/* Renderizado de tus gráficas */}
      <div className="charts-grid">
         {/* Aquí van tus componentes <Bar />, <Doughnut />, etc. */}
      </div>
    </div>
  );
}
