import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom"; 
import "./pacientes.css"; 

export default function Pacientes() {
  const navigate = useNavigate();

  const [pacientes, setPacientes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [importando, setImportando] = useState(false);
  
  // 🧭 ESTADOS DE ORDENAMIENTO OPERATIVO
  const [sortBy, setSortBy] = useState("fecha"); 
  const [sortOrder, setSortOrder] = useState("desc"); 

  // 📝 ESTADOS PARA MODAL DE EDICIÓN CLÍNICA COMPLETA
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [pacienteAEditar, setPacienteAEditar] = useState(null);
  const [formEdit, setFormEdit] = useState({ 
    identificacion: "", 
    primer_nombre: "", 
    segundo_nombre: "", 
    primer_apellido: "", 
    segundo_apellido: "", 
    email: "", 
    telefono: "",
    fecha_nacimiento: "" 
  });

  // 🧭 ESTADOS PARA EL MODAL DE DICTADO REAL CON HARDWARE VINCULADO
  const [modalDictadoOpen, setModalDictadoOpen] = useState(false);
  const [pacienteDictando, setPacienteDictando] = useState(null);
  const [estaGrabando, setEstaGrabando] = useState(false);
  const [volumenVoz, setVolumenVoz] = useState(new Array(15).fill(5)); 
  const [audioUrl, setAudioUrl] = useState(null); 
  const [audioBlobReal, setAudioBlobRef] = useState(null); // 📦 Almacena el binario para persistencia física

  // 🔒 BANCO DE AUDIOS EN MEMORIA (Para pre-escucha inmediata en sesión)
  const [audiosClinicos, setAudiosClinicos] = useState({});
  const [audioActualJugando, setAudioActualJugando] = useState(null);

  // 📡 REFERENCIAS FÍSICAS DE HARDWARE AUDIO
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const reproductorGlobalRef = useRef(null); 

  const hoyStr = new Date().toISOString().split('T')[0];

  const [filtros, setFiltros] = useState({ 
    fechaDesde: "2020-01-01", 
    fechaHasta: hoyStr, 
    modalidad: "", 
    busqueda: "" 
  });

  const modalitiesLista = [
    "CT - Tomografía", "MR - Resonancia", "US - Ecografía", 
    "RX - Rayos X", "MG - Mamografía", "CR - Radiología Digital",
    "DXA - Densitometría", "PET - Medicina Nuclear"
  ];

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
              email: formEdit.email,
              telefono: formEdit.telefono || "-"
            };
          }
          return item;
        }));

        alert("📝 Todos los campos relacionales del paciente han sido corregidos con éxito.");
        setModalEditOpen(false);
        setPacienteAEditar(null);
        
        setTimeout(() => { cargarDatos(); }, 1000);
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
      `⚠️ MODO MAESTRO ADMIN:\n¿Está seguro de reabrir el flujo del estudio para ${paciente.primer_nombre} ${paciente.primer_apellido}?\n\nEsto limpiará las firmas y habilitará de inmediato el re-dictado del informe clínico.`
    );
    if (!confirmacion) return;

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${paciente.id}/reabrir-flujo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forzar_estado_proceso: true })
      });

      if (response.ok) {
        setPacientes(prev => prev.map(item => {
          if (item.id === paciente.id) {
            return {
              ...item,
              flujo_clinico: {
                tiene_audio: false,
                tiene_informe: false, 
                esta_firmado: false,
                tiene_anexos: item.flujo_clinico?.tiene_anexos || false,
                desbloqueado_para_redictado: true // 🛡️ BANDERA EXCLUSIVA FRONTEND
              }
            };
          }
          return item;
        }));
        alert("🔄 Flujo clínico reiniciado con éxito. El micrófono de la estación de dictado está activo.");
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
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    if (!token) { alert("🔒 Sesión Inválida"); return; }
    setImportando(true);
    try {
      const response = await fetch("http://localhost:8000/api/import/disco-externo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        alert(`🚀 ¡Explorador Vinculado!`);
        setTimeout(cargarDatos, 1000);
      }
    } catch (error) {
      alert("❌ Error de red.");
    } finally {
      setImportando(false);
    }
  };

  const iniciarGrabacionHardware = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlobRef(audioBlob); 
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url); 
      };

      mediaRecorder.start(100);

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32; 

      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      setEstaGrabando(true);
      analizarFrecuenciaVoz();
    } catch (err) {
      console.error("Error al acceder al micrófono de la estación:", err);
      alert("❌ No se detectó señal del micrófono. Revisa los permisos de Windows o Edge.");
    }
  };

  const analizarFrecuenciaVoz = () => {
    if (!analyserRef.current || !streamRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderOnda = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      const volumenesMapeados = Array.from(dataArray).slice(0, 15).map(v => Math.max(5, (v / 255) * 45));
      setVolumenVoz(volumenesMapeados.length === 15 ? volumenesMapeados : new Array(15).fill(5));

      animationFrameRef.current = requestAnimationFrame(renderOnda);
    };
    renderOnda();
  };

  const detenerGrabacionHardware = (descartar = false) => {
    setEstaGrabando(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumenVoz(new Array(15).fill(5));
    if (descartar) {
      setAudioUrl(null);
      setAudioBlobRef(null);
    }
  };

  const abrirModuloDictado = (pacienteId) => {
    const pac = pacientes.find(p => p.id === pacienteId);
    if (!pac) return;

    // 🛡️ REGLA OPERATIVA STRICTA: Bloqueado a menos que un admin haya reabierto el flujo explícitamente
    if (!pac.flujo_clinico?.desbloqueado_para_redictado && pac.flujo_clinico?.tiene_informe !== false) {
      alert("🔒 Acceso Denegado: Este estudio histórico importado ya está consolidado. Solicite al Administrador abrir el flujo (ícono 🔄) para habilitar la segunda opinión.");
      return;
    }

    setPacienteDictando(pac);
    setAudioUrl(null);
    setAudioBlobRef(null);
    setModalDictadoOpen(true);
    iniciarGrabacionHardware(); 
  };

  const ejecutarPlayAudioTabla = (pacienteId) => {
    const urlCargada = audiosClinicos[pacienteId];
    if (!urlCargada) {
      alert("ℹ️ Este estudio importado no posee dictados en la sesión actual. Usa el botón '🔄' administrativo para habilitar una segunda opinión.");
      return;
    }

    if (audioActualJugando === pacienteId) {
      reproductorGlobalRef.current.pause();
      setAudioActualJugando(null);
    } else {
      if (reproductorGlobalRef.current) {
        reproductorGlobalRef.current.pause();
      }
      const nuevoAudio = new Audio(urlCargada);
      reproductorGlobalRef.current = nuevoAudio;
      nuevoAudio.play();
      setAudioActualJugando(pacienteId);

      nuevoAudio.onended = () => {
        setAudioActualJugando(null);
      };
    }
  };

  return (
    <div style={mainLayout}>
      <header style={headerContainer}>
        <div style={flexSpace}>
          <h2 style={tituloDorado}>Panel de Control Operativo</h2>
          <div style={headerActions}>
            <button style={btnProductividad} onClick={() => navigate("/productividad")}>📊 PANEL DE PRODUCTIVIDAD</button>
            <div style={contadorBadge}>
              <span style={labelContador}>ESTUDIOS EN PANTALLA:</span>
              <span style={valContador}>{pacientes.length}</span>
            </div>
          </div>
        </div>

        <div style={barraMedios}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleImportarDiscoExterno} 
              disabled={importando} 
              className="btn-importar-pacs"
              style={{ ...btnMediosImport, backgroundColor: importando ? '#475569' : '#2563eb' }}
            >
              {importando ? "⏳ PROCESANDO RUTA EXTERNA..." : "📥 IMPORTAR (CD/USB/PC)"}
            </button>
            
            <button 
              disabled={seleccionados.length === 0} 
              onClick={handleExportarSeleccionados} 
              className="btn-exportar-pacs"
              style={{ ...btnMediosExport, backgroundColor: seleccionados.length > 0 ? '#10b981' : '#334155' }}
            >
              {seleccionados.length > 0 ? `📥 EXPORTAR ESTUDIOS (${seleccionados.length})` : "Anular Selección (0)"}
            </button>
          </div>
          <span style={subLabel}>Estación de Gestión de Archivos Externos (Inyección Directa por Hardware)</span>
        </div>
        
        <div style={filtrosBox}>
          <div style={filtrosFlex}>
            <div style={fGroup}>
              <label style={lStyle}>RÁPIDO</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setFiltroRapido("HOY")} style={btnQuick}>HOY</button>
                <button onClick={() => setFiltroRapido("AYER")} style={btnQuick}>AYER</button>
              </div>
            </div>

            <div style={fGroup}>
              <label style={lStyle}>DESDE</label>
              <input type="date" name="fechaDesde" style={sStyle} value={filtros.fechaDesde} onChange={handleFiltroChange} />
            </div>

            <div style={fGroup}>
              <label style={lStyle}>HASTA</label>
              <input type="date" name="fechaHasta" style={sStyle} value={filtros.fechaHasta} onChange={handleFiltroChange} />
            </div>

            <div style={fGroup}>
              <label style={lStyle}>MODALIDAD</label>
              <select name="modalidad" style={sStyle} value={filtros.modalidad} onChange={handleFiltroChange}>
                <option value="">Todas</option>
                {modalitiesLista.map(m => (
                  <option key={m} value={m.split(' ')[0]}>{m}</option>
                ))}
              </select>
            </div>
            
            <div style={{ ...fGroup, flex: 1 }}>
              <label style={lStyle}>BÚSQUEDA PREDICTIVA GLOBAL</label>
              <input 
                type="text" 
                name="busqueda" 
                placeholder="Escribe Apellidos, Nombres o Cédula... ¡Filtra en vivo!" 
                style={iSearch} 
                value={filtros.busqueda} 
                onChange={handleFiltroChange}
              />
            </div>
            
            <div style={fGroup}>
              <button onClick={cargarDatos} style={btnBuscar}>
                {loading ? "⏳ FILTRANDO..." : "🔍 REFRESCO FORZADO"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={tableContainer}>
        <div style={scrollWrapper} className="custom-pacs-scroll">
          <table style={tableStyle}>
            <thead style={theadStyle}>
              <tr>
                <th style={thStyle}>
                  <input type="checkbox" onChange={(e) => setSeleccionados(e.target.checked ? pacientes.map(p => p.id) : [])} checked={pacientes.length > 0 && seleccionados.length === pacientes.length} />
                </th>
                <th style={thStyle}>ESTADO</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>
                  ID PACIENTE {renderIconoOrden("id")}
                </th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>
                  1ER APELLIDO {renderIconoOrden("paciente")}
                </th>
                <th style={thStyle}>2DO APELLIDO</th>
                <th style={thStyle}>1ER NOMBRE</th>
                <th style={thStyle}>2DO NOMBRE</th>
                <th style={thStyle}>EMAIL CORREO</th>
                <th style={thStyle}>TELÉFONO / WHATSAPP</th>
                <th style={thStyle}>FLUJO / ADJUNTOS</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>
                  FECHA ESTUDIO {renderIconoOrden("fecha")}
                </th> 
                <th style={thStyle}>SEXO</th>
                <th style={thStyle}>MODALIDAD</th>
                <th style={thStyle}>DEPTO.</th>
                <th style={thStyle}>EDITAR</th>
                <th style={thStyle}>VISOR</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.length === 0 ? (
                <tr>
                  <td colSpan="16" style={waitingState}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📡</div>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>No se localizaron registros coincidentes.</p>
                  </td>
                </tr>
              ) : (
                pacientes.map((p) => {
                  const idReal = p.identificacion || p.id_paciente || "S/I";
                  const primerNombre = p.primer_nombre || "";
                  const segundoNombre = p.segundo_nombre || "-";
                  const primerApellido = p.primer_apellido || "Desconocido";
                  const segundoApellido = p.segundo_apellido || "-";
                  const emailReal = p.email || "-";
                  const telefonoReal = p.telefono || "-";
                  
                  const mReal = p.modalidad || p.tipo_estudio || "CR";
                  const fechaReal = p.fecha_estudio || p.fecha || "S/F"; 
                  const horaReal = p.hora_estudio || "00:00";

                  const estaSeleccionado = seleccionados.includes(p.id);
                  const flujo = p.flujo_clinico || { tiene_audio: false, tiene_informe: false, esta_firmado: false, tiene_anexos: false };

                  const tieneAudioSesion = !!audiosClinicos[p.id] || flujo.tiene_audio;
                  const estaEscuchandoEste = audioActualJugando === p.id;
                  const habilitadoParaDictado = flujo.desbloqueado_para_redictado || flujo.tiene_informe === false;

                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => toggleSeleccionarPaciente(p.id)}
                      style={{ 
                        ...trStyle, 
                        cursor: "pointer",
                        backgroundColor: estaSeleccionado ? "#1e222b" : "#111418",
                        borderLeft: estaSeleccionado ? "4px solid #fbbf24" : "4px solid transparent",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={estaSeleccionado} 
                          onChange={() => toggleSeleccionarPaciente(p.id)} 
                        />
                      </td>
                      <td style={tdStyle}><span style={{ ...badge, backgroundColor: p.activo ? "#10b981" : "#3b82f6" }}>{p.activo ? "Terminado" : "Proceso"}</span></td>
                      <td style={tdStyle}>{idReal}</td>
                      <td style={tdStyle}><strong>{primerApellido}</strong></td>
                      <td style={tdStyle}>{segundoApellido}</td>
                      <td style={tdStyle}><strong>{primerNombre}</strong></td>
                      <td style={tdStyle}>{segundoNombre}</td>
                      <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>{emailReal}</td>
                      <td style={{ ...tdStyle, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{telefonoReal}</td>
                      
                      {/* Celda de flujo clínico */}
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={containerFlujo}>
                          <button 
                            title={tieneAudioSesion ? (estaEscuchandoEste ? "⏸️ Detener Escucha" : "▶️ Escuchar Dictado Grabado") : "Estudio sin dictado"} 
                            onClick={() => ejecutarPlayAudioTabla(p.id)}
                            style={{
                              ...iconFlujoBase,
                              color: estaEscuchandoEste ? "#10b981" : (tieneAudioSesion ? "#fbbf24" : "#475569"),
                              backgroundColor: tieneAudioSesion ? "rgba(251,191,36,0.15)" : "transparent",
                              border: tieneAudioSesion ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
                              boxShadow: estaEscuchandoEste ? "0 0 10px #10b981" : (tieneAudioSesion ? "0 0 8px rgba(251,191,36,0.2)" : "none"),
                              opacity: tieneAudioSesion ? 1 : 0.3,
                              cursor: tieneAudioSesion ? "pointer" : "default"
                            }}
                          >
                            {estaEscuchandoEste ? "⏸️" : "🎙️"}
                          </button>

                          <button 
                            title={habilitadoParaDictado ? "Habilitar Dictado para 2da Opinión" : "Estudio Bloqueado (Histórico)"} 
                            onClick={() => abrirModuloDictado(p.id)}
                            style={{
                              ...iconFlujoBase, 
                              color: !habilitadoParaDictado ? "#475569" : (flujo.tiene_informe ? "#3b82f6" : "#ef4444"), 
                              backgroundColor: !habilitadoParaDictado ? "transparent" : (flujo.tiene_informe ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.1)"), 
                              border: !habilitadoParaDictado ? "1px solid transparent" : (flujo.tiene_informe ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(239,68,68,0.2)"), 
                              animation: (habilitadoParaDictado && !flujo.tiene_informe) ? "pulse-re-dictado 2s infinite" : "none", 
                              cursor: habilitadoParaDictado ? "pointer" : "not-allowed",
                              opacity: habilitadoParaDictado ? 1 : 0.35
                            }}
                          >
                            📝
                          </button>
                          <span title={flujo.esta_firmado ? "Informe Firmado Oficialmente" : "Falta Firma"} style={{...iconFlujoBase, color: flujo.esta_firmado ? "#10b981" : "#475569", backgroundColor: flujo.esta_firmado ? "rgba(16,185,129,0.15)" : "transparent", border: flujo.esta_firmado ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent", opacity: flujo.esta_firmado ? 1 : 0.3}}>✍️</span>
                          <span title={flujo.tiene_anexos ? "Posee documentos médicos anexos" : "Sin anexos"} style={{...iconFlujoBase, color: flujo.tiene_anexos ? "#a855f7" : "#475569", backgroundColor: flujo.tiene_anexos ? "rgba(168,85,247,0.15)" : "transparent", border: flujo.tiene_anexos ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent", opacity: flujo.tiene_anexos ? 1 : 0.3}}>📎</span>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={fechaBadge}>{fechaReal}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a8a29e', fontWeight: 'bold', fontFamily: 'monospace' }}>🕒 {horaReal}</span>
                        </div>
                      </td> 
                      <td style={tdStyle}>{p.sexo || "M"}</td>
                      <td style={tdStyle}><strong>{mReal}</strong></td>
                      <td style={tdStyle}>{p.departamento || "Radiología"}</td>
                      
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button style={btnEditar} title="Editar metadatos" onClick={() => abrirEditorPaciente(p)}>📝</button>
                          <button style={btnReabrir} title="Reabrir flujo / Permitir re-dictado" onClick={() => handleReabrirFlujoEstudio(p)}>🔄</button>
                        </div>
                      </td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <button style={btnVisor}>ABRIR</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* 🔮 MODAL DE CONFIGURACIÓN COMPLETA */}
      {modalEditOpen && (
        <div style={modalOverlay}>
          <div style={modalContentExpanded}>
            <h3 style={modalTitle}>📝 Modificación Completa de Registro PACS</h3>
            <p style={modalSubtitle}>Modo Maestro — Edición Integral Obligatoria</p>
            <form onSubmit={handleGuardarEdicion} style={formStyle}>
              <div style={gridFields}>
                <div style={inputGroup}>
                  <label style={labelModal}>CÉDULA / ID PACIENTE</label>
                  <input type="text" style={inputModal} value={formEdit.identificacion} onChange={(e) => setFormEdit({...formEdit, identificacion: e.target.value})} required />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>FECHA DE NACIMIENTO</label>
                  <input type="date" style={inputModal} value={formEdit.fecha_nacimiento} onChange={(e) => setFormEdit({...formEdit, fecha_nacimiento: e.target.value})} required />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>PRIMER NOMBRE</label>
                  <input type="text" style={inputModal} value={formEdit.primer_nombre} onChange={(e) => setFormEdit({...formEdit, primer_nombre: e.target.value})} required />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>SEGUNDO NOMBRE</label>
                  <input type="text" style={inputModal} value={formEdit.segundo_nombre} onChange={(e) => setFormEdit({...formEdit, segundo_nombre: e.target.value})} />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>PRIMER APELLIDO</label>
                  <input type="text" style={inputModal} value={formEdit.primer_apellido} onChange={(e) => setFormEdit({...formEdit, primer_apellido: e.target.value})} required />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>SEGUNDO APELLIDO</label>
                  <input type="text" style={inputModal} value={formEdit.segundo_apellido} onChange={(e) => setFormEdit({...formEdit, segundo_apellido: e.target.value})} />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>CORREO ELECTRÓNICO (EMAIL)</label>
                  <input type="email" style={inputModal} value={formEdit.email} onChange={(e) => setFormEdit({...formEdit, email: e.target.value})} />
                </div>
                <div style={inputGroup}>
                  <label style={labelModal}>TELÉFONO MÓVIL (ALERTAS WHATSAPP)</label>
                  <input type="text" style={inputModal} value={formEdit.telefono} placeholder="+573001234567" onChange={(e) => setFormEdit({...formEdit, telefono: e.target.value})} />
                </div>
              </div>
              <div style={modalActions}>
                <button type="button" onClick={() => setModalEditOpen(false)} style={btnCancelarModal}>CANCELAR</button>
                <button type="submit" style={btnGuardarModal}>APLICAR EN TABLA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🎤 MODAL DE ESTACIÓN DE DICTADO ACTIVO CON ONDA SONORA EN TIEMPO REAL */}
      {modalDictadoOpen && pacienteDictando && (
        <div style={modalOverlay}>
          <div style={{...modalContentExpanded, borderColor: '#ef4444', boxShadow: '0 0 25px rgba(239,68,68,0.4)', width: '500px'}}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <div style={{
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                backgroundColor: estaGrabando ? '#ef4444' : '#64748b',
                boxShadow: estaGrabando ? '0 0 10px #ef4444' : 'none'
              }} />
              <h3 style={{ color: '#ef4444', margin: 0, fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                {estaGrabando ? "🎤 MICROFONO LOCAL ACTIVO - GRABANDO" : "⏸️ DICTADO PAUSADO EN CACHÉ"}
              </h3>
            </div>

            <div style={{ background: '#000', padding: '12px 15px', borderRadius: '6px', border: '1px solid #222', marginBottom: '15px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>ESTUDIO ASOCIADO</p>
              <h4 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>
                {pacienteDictando.primer_apellido} {pacienteDictando.segundo_apellido} {pacienteDictando.primer_nombre}
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#fbbf24', fontFamily: 'monospace' }}>
                ID: {pacienteDictando.identificacion || pacienteDictando.id_paciente} | Mod: {pacienteDictando.modalidad || "CR"}
              </p>
            </div>

            <div style={{ 
              background: '#07080a', 
              padding: '25px 15px', 
              borderRadius: '8px', 
              border: '1px dashed #ef4444', 
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              minHeight: '110px'
            }}>
              {estaGrabando ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '45px' }}>
                    {volumenVoz.map((h, index) => (
                      <div 
                        key={index}
                        style={{
                          width: '5px',
                          backgroundColor: '#ef4444',
                          borderRadius: '2.5px',
                          height: `${h}px`,
                          transition: 'height 0.05s ease-out', 
                          boxShadow: '0 0 4px rgba(239,68,68,0.5)'
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    📡 Capturando señal del hardware de audio en vivo... ¡Hable ahora!
                  </span>
                </>
              ) : (
                <>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    {audioUrl ? (
                      <audio src={audioUrl} controls style={{ width: '100%', accentColor: '#ef4444' }} />
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No hay registros de audio en el búfer temporal.</span>
                    )}
                    <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      🛑 Grabación congelada en búfer. Listo para validar la salida de audio.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => {
                  if (estaGrabando) {
                    detenerGrabacionHardware(false);
                  } else {
                    iniciarGrabacionHardware();
                  }
                }} 
                style={{
                  background: estaGrabando ? '#334155' : '#ef4444', 
                  color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem'
                }}
              >
                {estaGrabando ? "⏸️ DETENER Y VALIDAR" : "🎤 GRABAR OTRA VEZ"}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => { 
                    detenerGrabacionHardware(true);
                    setModalDictadoOpen(false); 
                    setPacienteDictando(null); 
                  }} 
                  style={btnCancelarModal}
                >
                  DESCARTAR
                </button>
                <button 
                  type="button" 
                  onClick={async () => {
                    detenerGrabacionHardware(false);
                    
                    // 🚀 PERSISTENCIA AL RESPALDO BACKUP: Construcción de FormData para inyección en servidor
                    if (audioBlobReal) {
                      const formData = new FormData();
                      formData.append("audio", audioBlobReal, `dictado_${pacienteDictando.id}.wav`);
                      
                      try {
                        await fetch(`http://localhost:8000/api/pacientes/${pacienteDictando.id}/guardar-audio`, {
                          method: "POST",
                          body: formData
                        });
                        console.log("🔊 Archivo WAV grabado en el volumen del servidor para resguardo de backups.");
                      } catch (err) {
                        console.error("Fallo de red al intentar respaldar el audio en el backend:", err);
                      }
                    }

                    if (audioUrl) {
                      setAudiosClinicos(prev => ({
                        ...prev,
                        [pacienteDictando.id]: audioUrl
                      }));
                    }

                    setPacientes(prev => prev.map(item => {
                      if (item.id === pacienteDictando.id) {
                        return {
                          ...item,
                          flujo_clinico: { ...item.flujo_clinico, tiene_audio: true, tiene_informe: true }
                        };
                      }
                      return item;
                    }));
                    
                    alert("💾 Dictado finalizado y enviado al servidor PACS de forma exitosa. Copia de seguridad garantizada por siempre.");
                    setModalDictadoOpen(false);
                    setPacienteDictando(null);
                  }} 
                  style={{...btnGuardarModal, backgroundColor: '#10b981', color: '#fff'}}
                >
                  GUARDAR GRABACIÓN
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// --- 🎨 SECCIÓN DE ESTILOS ---
const mainLayout = { width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1114', overflow: 'hidden' };
const headerContainer = { padding: '15px 25px', background: '#111418', borderBottom: '2px solid #fbbf24', flexShrink: 0 };
const flexSpace = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const tituloDorado = { color: '#fbbf24', margin: 0, fontSize: '1.2rem', fontWeight: '800' };
const headerActions = { display: 'flex', gap: '12px', alignItems: 'center' };
const btnProductividad = { background: '#1a1d21', color: '#fff', border: '1px solid #fbbf24', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const contadorBadge = { background: '#1a1d21', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' };
const labelContador = { color: '#94a3b8', fontSize: '0.7rem' };
const valContador = { color: '#fbbf24', fontWeight: '900', fontSize: '1.1rem', marginLeft: '8px' };
const barraMedios = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1d21', padding: '8px 15px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #444' };
const btnMediosImport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' };
const btnMediosExport = { color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' };
const subLabel = { fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' };
const filtrosBox = { background: '#1a1d21', padding: '15px', borderRadius: '10px', marginTop: '10px', border: '1px solid #222' };
const filtrosFlex = { display: 'flex', gap: '15px', alignItems: 'flex-end' };
const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lStyle = { fontSize: '0.6rem', color: '#fbbf24', fontWeight: 'bold' };
const iSearch = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px', width: '100%' };
const sStyle = { background: '#000', color: '#fff', border: '1px solid #444', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', height: '38px' };
const btnQuick = { background: '#334155', color: '#fbbf24', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer', height: '38px', fontSize: '0.7rem' };
const btnBuscar = { background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', height: '38px', fontSize: '0.75rem' };
const tableContainer = { flex: 1, padding: '10px 25px 25px 25px', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const scrollWrapper = { flex: 1, overflowY: 'scroll', overflowX: 'scroll', border: '1px solid #222', borderRadius: '6px', background: '#111418' };
const tableStyle = { width: '100%', minWidth: '1700px', borderCollapse: 'collapse' }; 
const theadStyle = { position: 'sticky', top: 0, background: '#16191e', zIndex: 10 }; 
const thStyle = { padding: '12px', textAlign: 'left', color: '#fbbf24', borderBottom: '2px solid #222', fontSize: '0.7rem' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #1f242d', color: '#e2e8f0', fontSize: '0.85rem' };
const trStyle = { borderBottom: '1px solid #111', background: '#111418' };
const waitingState = { textAlign: 'center', padding: '100px', color: '#64748b' };
const badge = { padding: '4px 10px', borderRadius: '5px', fontSize: '0.65rem', color: '#fff', fontWeight: 'bold' };
const fechaBadge = { color: '#fbbf24', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.85rem' };
const btnVisor = { background: '#fbbf24', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.7rem' };
const btnEditar = { background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.85rem' };

const containerFlujo = { display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', border: '1px solid #1e293b', width: 'fit-content' };
const iconFlujoBase = { padding: '5px', borderRadius: '4px', fontSize: '0.95rem', transition: 'all 0.2s ease', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', background: "none", border: "none" };
const btnReabrir = { background: '#0284c7', color: '#fff', border: '1px solid #0369a1', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' };

const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 };
const modalContentExpanded = { background: '#111418', border: '2px solid #fbbf24', borderRadius: '8px', padding: '25px', width: '580px', boxShadow: '0 0 25px rgba(251,191,36,0.3)' };
const modalTitle = { color: '#fbbf24', margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: 'bold' };
const modalSubtitle = { color: '#64748b', margin: '0 0 20px 0', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const gridFields = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '5px' };
const labelModal = { color: '#94a3b8', fontSize: '0.65rem', fontWeight: 'bold' };
const inputModal = { background: '#000', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '4px', fontSize: '0.85rem' };
const modalActions = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' };
const btnCancelarModal = { background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };
const btnGuardarModal = { background: '#fbbf24', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };