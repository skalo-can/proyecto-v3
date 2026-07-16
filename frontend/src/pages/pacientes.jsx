import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import "./pacientes.css"; 

// Subcomponentes Estructurados
import ModalEdicionPaciente from "./ModalEdicionPaciente";
import FiltrosPacientes from "./FiltrosPacientes";
import TablaPacientes from "./TablaPacientes";

// Capa de Hooks y Utilidades independientes
import { useAudioRecorder } from "./useAudioRecorder";
import { modalitiesLista } from "./modalidades";
import { styles } from "./pacientesStyles";

export default function Pacientes() {
  const navigate = useNavigate();

  // Estados Locales de Datos e Interfaz
  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  
  const [sortBy, setSortBy] = useState("fecha"); 
  const [sortOrder, setSortOrder] = useState("desc"); 

  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);
  const [formEdit, setFormEdit] = useState({ 
    identificacion: "", primer_nombre: "", segundo_nombre: "", 
    primer_apellido: "", segundo_apellido: "", email: "", telefono: "", fecha_nacimiento: "" 
  });

  const [estudiosAutorizados, setEstudiosAutorizados] = useState({});
  const [audiosClinicos, setAudiosClinicos] = useState({});
  const [audioActualJugando, setAudioActualJugando] = useState(null);

  const reproductorGlobalRef = useRef(null); 
  const hoyStr = new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState({ 
    fechaDesde: hoyStr, fechaHasta: hoyStr, fechaExacta: "", modalidad: "", busqueda: "", estado: "" 
  });

  // 🔥 ESTADO: El interruptor del "Extra Power"
  const [busquedaProfunda, setBusquedaProfunda] = useState(false);

  const audioRecorder = useAudioRecorder();

  // Solicitudes HTTP de Repositorio PACS
  const cargarDatos = useCallback(() => {
    setLoading(true);
    
    // 🧠 LÓGICA MAESTRA DEL FILTRADO PROFUNDO BLINDADO
    let paramsObj = {
      modalidad: filtros.modalidad || "",
      estado: filtros.estado || "",
      busqueda: filtros.busqueda || "",
      sort_by: sortBy,
      order: sortOrder
    };

    if (busquedaProfunda) {
      // 🛡️ SEGURO CONTRA VOLCADOS DE RAM:
      // Si el botón está encendido, pero no han escrito a quién buscar ni fecha exacta...
      if (filtros.busqueda.trim() === "" && filtros.fechaExacta === "") {
        // ...Mantenemos el límite de fechas actual (Ej. Hoy) para no saturar la pantalla.
        paramsObj.fechaDesde = filtros.fechaDesde;
        paramsObj.fechaHasta = filtros.fechaHasta;
      } else {
        // Si YA escribieron un nombre, cédula o fecha, abrimos las compuertas del tiempo.
        paramsObj.fechaDesde = filtros.fechaExacta || "";
        paramsObj.fechaHasta = filtros.fechaExacta || ""; 
      }
    } else {
      // Búsqueda normal por rango de fechas
      paramsObj.fechaDesde = filtros.fechaDesde;
      paramsObj.fechaHasta = filtros.fechaHasta;
    }

    const params = new URLSearchParams(paramsObj);

    fetch(`http://localhost:8000/api/pacientes?${params}`) 
      .then((res) => res.json())
      .then((data) => {
        setPacientes(Array.isArray(data) ? data : (data.items || []));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando el repositorio PACS:", err);
        setLoading(false);
      });
  }, [filtros, sortBy, sortOrder, busquedaProfunda]);

  useEffect(() => { 
    cargarDatos(); 
  }, [cargarDatos]);

  // 📡 CANAL DE COMUNICACIÓN MULTIMONITOR
  useEffect(() => {
    const canalRefresco = new BroadcastChannel("mipacs_refresco_flujo");
    
    canalRefresco.onmessage = (evento) => {
      if (evento.data === "actualizar_tabla") {
        cargarDatos(); 
      }
    };

    return () => canalRefresco.close();
  }, [cargarDatos]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setSeleccionados([]); 
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const solicitarOrdenamiento = (columna) => {
    let columnaBackend = columna;
    if (columna === "paciente") columnaBackend = "nombre"; 
    if (columna === "fecha") columnaBackend = "fecha_estudio"; 

    if (sortBy === columnaBackend) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnaBackend);
      setSortOrder("asc");
    }
  };

  const renderIconoOrden = (columna) => {
    let columnaBackend = columna;
    if (columna === "paciente") columnaBackend = "nombre";
    if (columna === "fecha") columnaBackend = "fecha_estudio";

    if (sortBy !== columnaBackend) return <span style={{ color: '#475569', marginLeft: '5px' }}>↕</span>;
    return sortOrder === "asc" ? <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↑</span> : <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↓</span>;
  };
  
  const toggleSeleccionarPaciente = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 🔥 CEREBRO MATEMÁTICO DE FECHAS
  const setFiltroRapido = (tipo) => {
    const hoy = new Date();
    
    const formatearFecha = (fecha) => {
      const year = fecha.getFullYear();
      const month = String(fecha.getMonth() + 1).padStart(2, '0');
      const day = String(fecha.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const hoyStrLocal = formatearFecha(hoy);
    let desde = new Date();
    let hastaStr = hoyStrLocal; 

    setSeleccionados([]); 
    setBusquedaProfunda(false); // Apaga el interruptor si usamos botones rápidos
    
    if (tipo === "HOY") {
      // 'desde' ya es hoy
    } else if (tipo === "AYER") {
      desde.setDate(hoy.getDate() - 1);
      hastaStr = formatearFecha(desde);
    } else if (tipo === "SEMANA") {
      desde.setDate(hoy.getDate() - 7);
    }

    const desdeStr = formatearFecha(desde);
    setFiltros(prev => ({ ...prev, fechaDesde: desdeStr, fechaHasta: hastaStr }));
  };

  const abrirEditorPaciente = (paciente) => {
    const pacienteFresco = pacientes.find(p => p.id === paciente.id) || paciente;
    setPacienteAEditar(pacienteFresco);
    
    setFormEdit({
      identificacion: pacienteFresco.identificacion || "",
      primer_nombre: pacienteFresco.primer_nombre || "",
      segundo_nombre: pacienteFresco.segundo_nombre && pacienteFresco.segundo_nombre !== "-" ? pacienteFresco.segundo_nombre : "",
      primer_apellido: pacienteFresco.primer_apellido || "",
      segundo_apellido: pacienteFresco.segundo_apellido && pacienteFresco.segundo_apellido !== "-" ? pacienteFresco.segundo_apellido : "",
      email: pacienteFresco.email && pacienteFresco.email !== "-" ? pacienteFresco.email : "",
      telefono: pacienteFresco.telefono && pacienteFresco.telefono !== "-" ? pacienteFresco.telefono : "",
      fecha_nacimiento: pacienteFresco.fecha_nacimiento || "1980-01-01"
    });
    setModalEditOpen(true);
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!pacienteAEditar) return;

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${pacienteAEditar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formEdit)
      });

      if (response.ok) {
        setPacientes(prevPacientes => prevPacientes.map(item => {
          if (item.id === pacienteAEditar.id) {
            return {
              ...item,
              ...formEdit,
              identificacion: formEdit.identificacion,
              primer_nombre: formEdit.primer_nombre,
              segundo_nombre: formEdit.segundo_nombre || "-",
              primer_apellido: formEdit.primer_apellido,
              segundo_apellido: formEdit.segundo_apellido || "-",
              email: formEdit.email || "-",
              telefono: formEdit.telefono || "-"
            };
          }
          return item;
        }));

        alert("📝 Todos los campos relacionales del paciente han sido corregidos con éxito.");
        setModalEditOpen(false);
        setPacienteAEditar(null);
      } else {
        const errorData = await response.json().catch(() => null);
        alert(`❌ Fallo en actualización: ${JSON.stringify(errorData?.detail || "Error en base de datos")}`);
      }
    } catch (error) {
      console.error("Error en la petición PUT:", error);
      alert("❌ Error de comunicación con la API.");
    }
  };

  const handleReabrirFlujoEstudio = async (paciente) => {
    const confirmacion = window.confirm(
      `⚠️ MODO MAESTRO ADMIN:\n¿Está seguro de autorizar y reabrir el flujo del estudio para ${paciente.primer_nombre} ${paciente.primer_apellido}?\n\nEsto habilitará explícitamente el micrófono para registrar la segunda opinión clínica.`
    );
    if (!confirmacion) return;

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${paciente.id}/reabrir-flujo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forzar_estado_proceso: true })
      });

      if (response.ok) {
        setEstudiosAutorizados(prev => ({ ...prev, [paciente.id]: true }));
        alert("🔄 Acceso Concedido. El micrófono y la casilla de dictado han sido habilitados.");
        cargarDatos();
      } else {
        alert("❌ Error al intentar alterar el flujo del estudio en el servidor.");
      }
    } catch (error) {
      console.error("Error al reabrir flujo:", error);
      alert("❌ Fallo en la comunicación de red con la API PACS.");
    }
  };

  // 🚀 VENTANAS INDEPENDIENTES MULTIMONITOR
  const abrirModuloDictado = (pacienteId) => {
    const pac = pacientes.find(p => p.id === pacienteId);
    if (!pac) return;
    
    if (!(!!estudiosAutorizados[pacienteId] || pac.estado_pacs === "Tomado")) {
        alert("🔒 Estudio Bloqueado: Requiere autorización del Administrador mediante el botón azul (🔄).");
        return;
    }
    
    const w = 1000, h = 950;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(`/visor-dictado/${pacienteId}`, `Dictado_${pacienteId}`, `width=${w},height=${h},top=${top},left=${left},resizable=yes`);
  };

  const abrirModalTranscriptor = (id) => {
    const w = 1300, h = 1000;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(`/visor-transcriptor/${id}`, `Transcriptor_${id}`, `width=${w},height=${h},top=${top},left=${left},resizable=yes`);
  };

  const abrirModalFirma = (id) => {
    const w = 1300, h = 1000;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(`/visor-firma/${id}`, `Firma_${id}`, `width=${w},height=${h},top=${top},left=${left},resizable=yes`);
  };

  const ejecutarPlayAudioTabla = (pacienteId) => {
    let urlCargada = audiosClinicos[pacienteId];

    if (!urlCargada) {
      const pac = pacientes.find(p => p.id === pacienteId);
      if (pac && (pac.estado_pacs === "Dictado" || (pac.flujo_clinico && pac.flujo_clinico.tiene_audio))) {
        urlCargada = `http://localhost:8000/api/pacientes/${pacienteId}/audio?t=${new Date().getTime()}`;
      } else {
        alert("ℹ️ No hay un dictado activo para reproducir.");
        return;
      }
    }

    if (audioActualJugando === pacienteId) {
      if (reproductorGlobalRef.current) reproductorGlobalRef.current.pause();
      setAudioActualJugando(null);
    } else {
      if (reproductorGlobalRef.current) reproductorGlobalRef.current.pause();
      const nuevoAudio = new Audio(urlCargada);
      reproductorGlobalRef.current = nuevoAudio;
      nuevoAudio.play().catch(e => {
        console.error("Fallo de audio:", e);
        alert("❌ El navegador no pudo reproducir el audio.");
      });
      setAudioActualJugando(pacienteId);

      nuevoAudio.onended = () => {
        setAudioActualJugando(null);
      };
    }
  };

  return (
    <div style={styles.mainLayout}>
      <header style={styles.headerContainer}>
        <div style={styles.flexSpace}>
          <h2 style={styles.tituloDorado}>Panel de Control Operativo</h2>
          <div style={styles.headerActions}>
            <button style={styles.btnProductividad} onClick={() => navigate("/productividad")}>📊 PANEL DE PRODUCTIVIDAD</button>
            <div style={styles.contadorBadge}>
              <span style={styles.labelContador}>ESTUDIOS EN PANTALLA:</span>
              <span style={styles.valContador}>{pacientes.length}</span>
            </div>
          </div>
        </div>
        
        <FiltrosPacientes 
          filtros={filtros} 
          handleFiltroChange={handleFiltroChange} 
          setFiltroRapido={setFiltroRapido} 
          cargarDatos={cargarDatos} 
          loading={loading}
          busquedaProfunda={busquedaProfunda}
          setBusquedaProfunda={setBusquedaProfunda} 
        />
      </header>

      <main style={styles.tableContainer}>
        <div style={styles.scrollWrapper} className="custom-pacs-scroll">
          <TablaPacientes 
            key={`tabla-pacs-${pacientes.length}-${pacientes.map(p => p.estado_pacs).join('-')}`}
            pacientes={pacientes} 
            seleccionados={seleccionados} 
            setSeleccionados={setSeleccionados} 
            toggleSeleccionarPaciente={toggleSeleccionarPaciente}
            solicitarOrdenamiento={solicitarOrdenamiento} 
            renderIconoOrden={renderIconoOrden} 
            audiosClinicos={audiosClinicos}
            audioActualJugando={audioActualJugando} 
            ejecutarPlayAudioTabla={ejecutarPlayAudioTabla} 
            estudiosAutorizados={estudiosAutorizados}
            abrirModuloDictado={abrirModuloDictado} 
            abrirEditorPaciente={abrirEditorPaciente} 
            handleReabrirFlujoEstudio={handleReabrirFlujoEstudio}
            abrirModalTranscriptor={abrirModalTranscriptor}
            abrirModalFirma={abrirModalFirma} 
          />
        </div>
      </main>

      <ModalEdicionPaciente isOpen={modalEditOpen} formEdit={formEdit} setFormEdit={setFormEdit} onCancelar={() => setModalEditOpen(false)} onGuardar={handleGuardarEdicion} />
    </div>
  );
}