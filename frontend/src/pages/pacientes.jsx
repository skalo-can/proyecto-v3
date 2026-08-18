import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import "./pacientes.css"; 

import ModalEdicionPaciente from "./ModalEdicionPaciente";
import FiltrosPacientes from "./FiltrosPacientes";
import TablaPacientes from "./TablaPacientes";
import ModalEnviarEstudios from "../components/Modals/ModalEnviarEstudios"; 

import { useAudioRecorder } from "./useAudioRecorder";
import { modalitiesLista } from "./modalidades";
import { styles } from "./pacientesStyles";
import { useAuth } from "../AuthContext"; 

export default function Pacientes() {
  const navigate = useNavigate();
  const { user } = useAuth(); 

  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]); // Ahora guardará estudio_interno_id
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
  const [modalEnvioOpen, setModalEnvioOpen] = useState(false);

  const reproductorGlobalRef = useRef(null); 

  // 🔥 PARCHE ANTI-SAFARI: Generador de fecha local infalible
  const obtenerFechaLocal = (diasOffset = 0) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diasOffset);
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  const hoyStr = obtenerFechaLocal(0);
  
  const [filtros, setFiltros] = useState({ 
    fechaDesde: hoyStr, fechaHasta: hoyStr, fechaExacta: "", modalidad: "", busqueda: "", estado: "" 
  });

  const [busquedaProfunda, setBusquedaProfunda] = useState(false);
  const audioRecorder = useAudioRecorder();

  // 🛡️ BLINDAJE EXTREMO DE LECTURA DE ROL Y FILTROS
  useEffect(() => {
    if (user) {
      const rolActual = String(user?.rol || "").toLowerCase().trim();
      
      const esUrgenciologo = user.es_urgenciologo === true;

      if (esUrgenciologo) {
        setFiltros(prev => ({ ...prev, estado: "Urgencia" }));
      } else if (rolActual.startsWith("medico")) {
        setFiltros(prev => ({ ...prev, estado: "Firmado" }));
      } else {
        switch (rolActual) {
          case "transcriptor": setFiltros(prev => ({ ...prev, estado: "Dictado" })); break;
          case "radiologo": setFiltros(prev => ({ ...prev, estado: "Tomado" })); break;
          case "tecnologo": setFiltros(prev => ({ ...prev, estado: "Importado" })); break;
          case "recepcion": setFiltros(prev => ({ ...prev, estado: "Firmado" })); break;  
          case "it_biomedica": setFiltros(prev => ({ ...prev, estado: "" })); break;
          default: setFiltros(prev => ({ ...prev, estado: "" })); break;
        }
      }
    }
  }, [user]);

  const cargarDatos = useCallback(() => {
    setLoading(true);
    let paramsObj = { modalidad: filtros.modalidad || "", estado: filtros.estado || "", busqueda: filtros.busqueda || "", sort_by: sortBy, order: sortOrder };

    if (busquedaProfunda) {
      if ((filtros.busqueda || "").trim() === "" && filtros.fechaExacta === "") {
        paramsObj.fechaDesde = filtros.fechaDesde; paramsObj.fechaHasta = filtros.fechaHasta;
      } else {
        paramsObj.fechaDesde = filtros.fechaExacta || ""; paramsObj.fechaHasta = filtros.fechaExacta || ""; 
      }
    } else {
      paramsObj.fechaDesde = filtros.fechaDesde; paramsObj.fechaHasta = filtros.fechaHasta;
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

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const canalRefresco = new BroadcastChannel("mipacs_refresco_flujo");
    canalRefresco.onmessage = (evento) => { if (evento.data === "actualizar_tabla") cargarDatos(); };
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

    if (sortBy === columnaBackend) setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    else { setSortBy(columnaBackend); setSortOrder("asc"); }
  };

  const renderIconoOrden = (columna) => {
    let columnaBackend = columna;
    if (columna === "paciente") columnaBackend = "nombre";
    if (columna === "fecha") columnaBackend = "fecha_estudio";
    if (sortBy !== columnaBackend) return <span style={{ color: '#475569', marginLeft: '5px' }}>↕</span>;
    return sortOrder === "asc" ? <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↑</span> : <span style={{ color: '#fbbf24', marginLeft: '5px' }}>↓</span>;
  };
  
  // 🔥 CORRECCIÓN: Ahora el checkbox usa el ID único del estudio
  const toggleSeleccionarPaciente = (estudioInternoId) => {
    setSeleccionados(prev => prev.includes(estudioInternoId) ? prev.filter(x => x !== estudioInternoId) : [...prev, estudioInternoId]);
  };

  const handleAbrirEnvioMultiple = () => { if (seleccionados.length > 0) setModalEnvioOpen(true); };

  const setFiltroRapido = (tipo) => {
    setSeleccionados([]); 
    setBusquedaProfunda(false); 
    
    let desdeStr = obtenerFechaLocal(0);
    let hastaStr = obtenerFechaLocal(0); 

    if (tipo === "AYER") { 
      desdeStr = obtenerFechaLocal(-1); 
      hastaStr = obtenerFechaLocal(-1); 
    } 
    else if (tipo === "SEMANA") { 
      desdeStr = obtenerFechaLocal(-7); 
    }

    setFiltros(prev => ({ ...prev, fechaDesde: desdeStr, fechaHasta: hastaStr }));
  };

  // La edición del paciente sigue actualizando al paciente, pero lo buscamos por el id del estudio de la fila
  const abrirEditorPaciente = (estudio) => {
    const p = pacientes.find(x => x.estudio_interno_id === estudio.estudio_interno_id) || estudio;
    setPacienteAEditar(p);
    setFormEdit({
      identificacion: p.identificacion || "", primer_nombre: p.primer_nombre || "",
      segundo_nombre: p.segundo_nombre && p.segundo_nombre !== "-" ? p.segundo_nombre : "",
      primer_apellido: p.primer_apellido || "", segundo_apellido: p.segundo_apellido && p.segundo_apellido !== "-" ? p.segundo_apellido : "",
      email: p.email && p.email !== "-" ? p.email : "", telefono: p.telefono && p.telefono !== "-" ? p.telefono : "",
      fecha_nacimiento: p.fecha_nacimiento || "1980-01-01"
    });
    setModalEditOpen(true);
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!pacienteAEditar) return;

    let motivoAuditoria = "";
    const rolActual = String(user?.rol || "").toLowerCase();
    
    if (rolActual === "tecnologo" || rolActual === "recepcion") {
      motivoAuditoria = window.prompt("⚠️ CONTROL DE AUDITORÍA:\nEscriba el motivo de la corrección demográfica:");
      if (!motivoAuditoria || motivoAuditoria.trim() === "") return alert("❌ Operación cancelada. Motivo obligatorio.");
    }

    const payload = { ...formEdit, modificado_por: user?.username || "Desconocido", motivo_cambio: motivoAuditoria };

    try {
      // Guardamos la edición usando el ID del paciente (esto afecta los datos generales)
      const response = await fetch(`http://localhost:8000/api/pacientes/${pacienteAEditar.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Reflejamos los cambios en todas las filas que pertenezcan a este paciente
        setPacientes(prev => prev.map(item => item.id === pacienteAEditar.id ? { ...item, ...formEdit, segundo_nombre: formEdit.segundo_nombre || "-", segundo_apellido: formEdit.segundo_apellido || "-", email: formEdit.email || "-", telefono: formEdit.telefono || "-" } : item));
        alert("📝 Datos corregidos y registrados.");
        setModalEditOpen(false); setPacienteAEditar(null);
      } else { alert(`❌ Fallo en actualización.`); }
    } catch (error) { alert("❌ Error de comunicación con la API."); }
  };

  // 🔥 CORRECCIÓN: Flujo apuntando a /estudio/{id}
  const handleReabrirFlujoEstudio = async (estudio) => {
    if (!window.confirm(`⚠️ MODO MAESTRO:\n¿Reabrir el flujo para este estudio de ${estudio.primer_nombre}?`)) return;
    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/estudio/${estudio.estudio_interno_id}/reabrir-flujo`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forzar_estado_proceso: true })
      });
      if (response.ok) { setEstudiosAutorizados(prev => ({ ...prev, [estudio.estudio_interno_id]: true })); alert("🔄 Flujo reabierto."); cargarDatos(); } 
      else { alert("❌ Error al alterar el flujo."); }
    } catch (error) { alert("❌ Fallo en la red."); }
  };

  // 🔥 CORRECCIÓN: Apuntando la validación del tecnólogo al estudio individual
  const handleMarcarTomado = async (estudioId) => {
    try {
      const token = user?.token || localStorage.getItem("token");
      const response = await fetch(`http://localhost:8000/api/pacientes/estudio/${estudioId}/marcar-tomado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        cargarDatos(); // Refresca la tabla automáticamente
      } else {
        alert("❌ Error al validar el estudio.");
      }
    } catch (error) {
      alert("❌ Error de comunicación con la API.");
    }
  };

  // 🔥 CORRECCIÓN: Los visores ahora abren usando el ID del estudio
  const abrirModuloDictado = (estudioId) => {
    const pac = pacientes.find(p => p.estudio_interno_id === estudioId);
    if (!pac) return;
    if (!(!!estudiosAutorizados[estudioId] || pac.estado_pacs === "Tomado")) return alert("🔒 Estudio Bloqueado.");
    window.open(`/visor-dictado/${estudioId}`, `Dictado_${estudioId}`, `width=1000,height=950,top=50,left=200,resizable=yes`);
  };

  const abrirModalTranscriptor = (estudioId) => window.open(`/visor-transcriptor/${estudioId}`, `Transcriptor_${estudioId}`, `width=1300,height=1000,top=50,left=100,resizable=yes`);
  const abrirModalFirma = (estudioId) => window.open(`/visor-firma/${estudioId}`, `Firma_${estudioId}`, `width=1300,height=1000,top=50,left=100,resizable=yes`);

  const ejecutarPlayAudioTabla = (estudioId) => {
    let urlCargada = audiosClinicos[estudioId];
    if (!urlCargada) {
      const pac = pacientes.find(p => p.estudio_interno_id === estudioId);
      if (pac && (pac.estado_pacs === "Dictado" || (pac.flujo_clinico && pac.flujo_clinico.tiene_audio))) {
        // 🔥 Buscando el audio del estudio específico
        urlCargada = `http://localhost:8000/api/pacientes/estudio/${estudioId}/audio?t=${new Date().getTime()}`;
      } else return alert("ℹ️ No hay un dictado activo para este estudio.");
    }

    if (audioActualJugando === estudioId) {
      if (reproductorGlobalRef.current) reproductorGlobalRef.current.pause();
      setAudioActualJugando(null);
    } else {
      if (reproductorGlobalRef.current) reproductorGlobalRef.current.pause();
      const nuevoAudio = new Audio(urlCargada);
      reproductorGlobalRef.current = nuevoAudio;
      nuevoAudio.play().catch(e => alert("❌ El navegador bloqueó el audio."));
      setAudioActualJugando(estudioId);
      nuevoAudio.onended = () => setAudioActualJugando(null);
    }
  };

  // 🔥 CORRECCIÓN: Filtramos los seleccionados por el ID del estudio
  const pacientesParaEnvio = pacientes.filter(p => seleccionados.includes(p.estudio_interno_id)).map(p => ({ ...p, modality: p.modalidad || p.modality || "OTRO" }));

  return (
    <div style={styles.mainLayout}>
      <header style={styles.headerContainer}>
        <div style={styles.flexSpace}>
          <h2 style={styles.tituloDorado}>Panel de Control Operativo</h2>
          <div style={{ ...styles.headerActions, display: 'flex', alignItems: 'center', gap: '15px' }}>
            {seleccionados.length > 0 && (<button onClick={handleAbrirEnvioMultiple} style={{ background: "#2563eb", color: "#fff", border: "1px solid #3b82f6", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>📤 Enviar DICOM ({seleccionados.length})</button>)}
            {/* 🔒 PROTEGIDO: Solo perfiles autorizados ven el botón de Productividad */}
            {['admin', 'superadmin', 'invitado'].includes(String(user?.rol || "").toLowerCase().trim()) && (
              <button style={styles.btnProductividad} onClick={() => navigate("/productividad")}>📊 PANEL DE PRODUCTIVIDAD</button>
            )}
            <div style={styles.contadorBadge}><span style={styles.labelContador}>ESTUDIOS EN PANTALLA:</span><span style={styles.valContador}>{pacientes.length}</span></div>
          </div>
        </div>
        <FiltrosPacientes filtros={filtros} handleFiltroChange={handleFiltroChange} setFiltroRapido={setFiltroRapido} cargarDatos={cargarDatos} loading={loading} busquedaProfunda={busquedaProfunda} setBusquedaProfunda={setBusquedaProfunda} />
      </header>

      <main style={styles.tableContainer}>
        <div style={styles.scrollWrapper} className="custom-pacs-scroll">
          <TablaPacientes 
            key={`tabla-pacs-${pacientes.length}`}
            pacientes={pacientes} seleccionados={seleccionados} setSeleccionados={setSeleccionados} 
            toggleSeleccionarPaciente={toggleSeleccionarPaciente} solicitarOrdenamiento={solicitarOrdenamiento} 
            renderIconoOrden={renderIconoOrden} audiosClinicos={audiosClinicos} audioActualJugando={audioActualJugando} 
            ejecutarPlayAudioTabla={ejecutarPlayAudioTabla} estudiosAutorizados={estudiosAutorizados}
            abrirModuloDictado={abrirModuloDictado} abrirEditorPaciente={abrirEditorPaciente} 
            handleReabrirFlujoEstudio={handleReabrirFlujoEstudio} abrirModalTranscriptor={abrirModalTranscriptor}
            abrirModalFirma={abrirModalFirma}
            
            // 🔥 PASAMOS LAS HERRAMIENTAS NUEVAS A LA TABLA
            handleMarcarTomado={handleMarcarTomado}
            rolUsuario={String(user?.rol || "").toLowerCase().trim()}
          />
        </div>
      </main>

      <ModalEdicionPaciente isOpen={modalEditOpen} formEdit={formEdit} setFormEdit={setFormEdit} onCancelar={() => setModalEditOpen(false)} onGuardar={handleGuardarEdicion} />
      <ModalEnviarEstudios isOpen={modalEnvioOpen} onClose={() => setModalEnvioOpen(false)} estudiosSeleccionados={pacientesParaEnvio} />
    </div>
  );
}