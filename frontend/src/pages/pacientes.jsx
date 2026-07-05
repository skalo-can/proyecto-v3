import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import "./pacientes.css"; 

// Subcomponentes Estructurados
import ModalDictadoHardware from "./ModalDictadoHardware";
import ModalEdicionPaciente from "./ModalEdicionPaciente";
import FiltrosPacientes from "./FiltrosPacientes";
import TablaPacientes from "./TablaPacientes";
import ModalTranscriptor from "../components/Modals/ModalTranscriptor";
import ModalFirma from "../components/Modals/ModalFirma"; // 👈 AGREGA ESTA LÍNEA

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
  const [importando, setImportando] = useState(false);
  
  const [sortBy, setSortBy] = useState("fecha"); 
  const [sortOrder, setSortOrder] = useState("desc"); 

  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);
  const [formEdit, setFormEdit] = useState({ 
    identificacion: "", primer_nombre: "", segundo_nombre: "", 
    primer_apellido: "", segundo_apellido: "", email: "", telefono: "", fecha_nacimiento: "" 
  });

  const [modalDictadoOpen, setModalDictadoOpen] = useState(false);
  const [pacienteDictando, setPacienteDictando] = useState(null);
  const [estudiosAutorizados, setEstudiosAutorizados] = useState({});
  const [audiosClinicos, setAudiosClinicos] = useState({});
  const [audioActualJugando, setAudioActualJugando] = useState(null);

  const reproductorGlobalRef = useRef(null); 
  const hoyStr = new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState({ 
    fechaDesde: "2020-01-01", fechaHasta: hoyStr, modalidad: "", busqueda: "" 
  });

  const [modalTranscriptorOpen, setModalTranscriptorOpen] = useState(false);
  const [transcriptorEstudioId, setTranscriptorEstudioId] = useState(null);

  // 🔒 ESTADOS DE CONTROL OPERATIVO PARA EL MÓDULO DE FIRMA DIGITAL
  const [modalFirmaOpen, setModalFirmaOpen] = useState(false);
  const [firmaEstudioId, setFirmaEstudioId] = useState(null);

  // Consumo del Hook de Audio Aislado
  const audioRecorder = useAudioRecorder();

  // Solicitudes HTTP de Repositorio PACS (RESTAURADO)
  const cargarDatos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      fechaDesde: filtros.fechaDesde, 
      fechaHasta: filtros.fechaHasta, 
      modalidad: filtros.modalidad || "",
      busqueda: filtros.busqueda || "",
      sort_by: sortBy,
      order: sortOrder
    });

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
  }, [filtros, sortBy, sortOrder]);

  useEffect(() => { 
    cargarDatos(); 
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

  const setFiltroRapido = (tipo) => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    setSeleccionados([]);
    
    if (tipo === "HOY") {
      setFiltros(prev => ({ ...prev, fechaDesde: hoyStr, fechaHasta: hoyStr }));
    } else if (tipo === "AYER") {
      const ayer = new Date();
      ayer.setDate(hoy.getDate() - 1);
      const ayerStr = ayer.toISOString().split('T')[0];
      setFiltros(prev => ({ ...prev, fechaDesde: ayerStr, fechaHasta: ayerStr }));
    }
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
      alert("❌ Error de comunicación con la API. Verifica los logs de Uvicorn.");
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

  const handleExportarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    alert(`📦 Exportando (${seleccionados.length}) estudios seleccionados.`);
    setSeleccionados([]);
  };

  const handleImportarDiscoExterno = async () => {
    let tokenCrudo = localStorage.getItem("access_token") || localStorage.getItem("token") || "";
    const tokenLimpio = tokenCrudo.replace(/['"]+/g, '').trim();
    
    if (!tokenLimpio) { 
      alert("🔒 Sesión Inválida. Por favor, inicia sesión de nuevo."); 
      return; 
    }
    
    setImportando(true);
    try {
      const response = await fetch("http://localhost:8000/api/importacion-fisica/disco-externo", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenLimpio}`
        }
      });
      
      const data = await response.json().catch(() => null);
      
      if (response.ok && data?.status === "success") {
        alert(`🚀 ¡Lectura de Disco Exitosa!\nSe detectaron ${data.archivos_detectados} archivos DICOM. Se están procesando en segundo plano sin congelar el sistema.`);
        
        cargarDatos(); 
        
        let intentos = 0;
        const intervaloRefresco = setInterval(() => {
          cargarDatos();
          intentos++;
          if (intentos >= 5) { 
            clearInterval(intervaloRefresco); 
          }
        }, 3000); 

      } else if (data?.status === "cancelled") {
        console.log("Importación cancelada por el usuario.");
      } else {
        alert(`❌ Error en el servidor PACS: ${data?.detail || "Fallo interno."}`);
      }
    } catch (error) {
      console.error("Error de red en importación:", error);
      alert("❌ Error de comunicación con la API. Verifica los logs.");
    } finally {
      setImportando(false);
    }
  };

  const abrirModuloDictado = (pacienteId) => {
    const pac = pacientes.find(p => p.id === pacienteId);
    if (!pac) return;
    if (!(!!estudiosAutorizados[pacienteId] || pac.estado_pacs === "Tomado")) {
      alert("🔒 Estudio Bloqueado: Requiere autorización.");
      return;
    }
    setPacienteDictando(pac);
    audioRecorder.setAudioUrl(null);
    audioRecorder.setAudioBlobReal(null);
    setModalDictadoOpen(true); 
    audioRecorder.iniciarGrabacionHardware(); 
  };

  const ejecutarPlayAudioTabla = (pacienteId) => {
    let urlCargada = audiosClinicos[pacienteId];

    // Si no está en la memoria temporal (porque recargaste la página), la construimos desde el backend
    if (!urlCargada) {
      const pac = pacientes.find(p => p.id === pacienteId);
      if (pac && (pac.estado_pacs === "Dictado" || (pac.flujo_clinico && pac.flujo_clinico.tiene_audio))) {
      // Apuntamos a la ruta añadiendo un parámetro único para evitar la caché
      urlCargada = `http://localhost:8000/api/pacientes/${pacienteId}/audio?t=${new Date().getTime()}`;
      } else {
        alert("ℹ️ No hay un dictado activo para reproducir. Registre el audio usando el botón 📝.");
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
        alert("❌ El navegador no pudo reproducir el audio. Verifica si el archivo se guardó correctamente en el backend.");
      });
      setAudioActualJugando(pacienteId);

      nuevoAudio.onended = () => {
        setAudioActualJugando(null);
      };
    }
  };

  const abrirModalTranscriptor = (id) => {
    setTranscriptorEstudioId(id);
    setModalTranscriptorOpen(true);
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

        <div style={styles.barraMedios}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleImportarDiscoExterno} 
              disabled={importando} 
              className="btn-importar-pacs"
              style={{ ...styles.btnMediosImport, backgroundColor: importando ? '#475569' : '#2563eb' }}
            >
              {importando ? "⏳ PROCESANDO RUTA EXTERNA..." : "📥 IMPORTAR (CD/USB/PC)"}
            </button>        
            <button 
              disabled={seleccionados.length === 0} 
              onClick={handleExportarSeleccionados} 
              className="btn-exportar-pacs"
              style={{ ...styles.btnMediosExport, backgroundColor: seleccionados.length > 0 ? '#10b981' : '#334155' }}
            >
              {seleccionados.length > 0 ? `📥 EXPORTAR ESTUDIOS (${seleccionados.length})` : "Anular Selección (0)"}
            </button>
          </div>
          <span style={styles.subLabel}>Estación de Gestión de Archivos Externos (Inyección Directa por Hardware)</span>
        </div>
        
        <FiltrosPacientes filtros={filtros} handleFiltroChange={handleFiltroChange} setFiltroRapido={setFiltroRapido} modalitiesLista={modalitiesLista} cargarDatos={cargarDatos} loading={loading} />
      </header>

      <main style={styles.tableContainer}>
        <div style={styles.scrollWrapper} className="custom-pacs-scroll">
          {/* 🛡️ CLAVE DINÁMICA: Forzamos el redibujado de la tabla al cambiar el volumen de datos o estados */}
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
            abrirModalFirma={(id) => { setFirmaEstudioId(id); setModalFirmaOpen(true); }}
          />
        </div>
      </main>

      <ModalEdicionPaciente isOpen={modalEditOpen} formEdit={formEdit} setFormEdit={setFormEdit} onCancelar={() => setModalEditOpen(false)} onGuardar={handleGuardarEdicion} />

      <ModalDictadoHardware 
        isOpen={modalDictadoOpen} 
        paciente={pacienteDictando} 
        estaGrabando={audioRecorder.estaGrabando} 
        volumenVoz={audioRecorder.volumenVoz} 
        audioUrl={audioRecorder.audioUrl}
        onIniciar={audioRecorder.iniciarGrabacionHardware}
        onPausarReanudar={() => audioRecorder.estaGrabando ? audioRecorder.pausarGrabacionHardware() : audioRecorder.reanudarGrabacionHardware()}
        onDescartar={() => { audioRecorder.detenerGrabacionHardware(true); setModalDictadoOpen(false); }}
        onGuardar={async () => {
          const idDestino = pacienteDictando.id;
          const blobParaEnviar = audioRecorder.audioBlobReal;
          const urlAGuardar = audioRecorder.audioUrl;
          
          // 1. Detener el hardware inmediatamente
          audioRecorder.detenerGrabacionHardware(false);
          
          if (urlAGuardar) {
            setAudiosClinicos(prev => ({ ...prev, [idDestino]: urlAGuardar }));
          }

          // 🛡️ BLOQUEO PREVENTIVO EN CALIENTE:
          // Forzamos que en la interfaz visual el estado cambie a "Dictado" YA MISMO,
          // así el botón del micrófono de la fila se apaga antes de que responda el servidor.
          // 🛡️ BLOQUEO PREVENTIVO EN CALIENTE CORREGIDO:
          // Modificamos la raíz del paciente donde sí existe 'estado_pacs' de forma directa
          setPacientes(prevPacientes => 
            prevPacientes.map(p => 
              p.id === idDestino 
                ? { 
                    ...p, 
                    estado_pacs: "Dictado",
                    flujo_clinico: { ...p.flujo_clinico, tiene_audio: true } 
                  }
                : p
            )
          );

          const conteoActual = parseInt(localStorage.getItem("firmas_medico") || "0");
          localStorage.setItem("firmas_medico", (conteoActual + 1).toString());

          // 2. Cerrar la ventana emergente
          setModalDictadoOpen(false);

          // 3. Envío del archivo de audio al servidor de forma asíncrona
          if (blobParaEnviar) {
            const formData = new FormData();
            formData.append("audio", blobParaEnviar, `dictado_${idDestino}.wav`);
            try {
              await fetch(`http://localhost:8000/api/pacientes/${idDestino}/guardar-audio`, {
                method: "POST",
                body: formData
              });
              
              // 🔄 Sincronización final con el servidor
              cargarDatos(); 
              setPacienteDictando(null);

            } catch (err) {
              console.error("Fallo de red al enviar dictado:", err);
              alert("❌ El audio no pudo ser guardado en el servidor. Intente de nuevo.");
            }
          }
        }}
        />

        <ModalTranscriptor 
          visible={modalTranscriptorOpen} 
          onClose={() => setModalTranscriptorOpen(false)} 
          estudioId={transcriptorEstudioId}
          onSave={cargarDatos} // 👈 Cambiado: Ejecuta la recarga de la API en caliente inmediatamente
        />

      {/* 🔒 MONTAJE OPERATIVO DEL COMPONENTE DE FIRMA DIGITAL */}
      <ModalFirma 
        visible={modalFirmaOpen} 
        onClose={() => setModalFirmaOpen(false)} 
        estudioId={firmaEstudioId}
        onSave={() => {
          cargarDatos(); // Refresca el repositorio clínico de inmediato
        }}
      />
    </div>
  );
}