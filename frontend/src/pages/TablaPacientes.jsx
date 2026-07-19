import React, { useState, useEffect } from "react";
import { obtenerEstiloModalidad } from "./modalidades";
import { styles } from "./pacientesStyles"; 

// 🚀 1. Importamos la seguridad directamente aquí
import { useAuth } from "../AuthContext"; 

export default function TablaPacientes({
  pacientes, // 🛑 Asegúrate de borrar 'user' de esta lista
  seleccionados,
  setSeleccionados,
  toggleSeleccionarPaciente,
  solicitarOrdenamiento,
  renderIconoOrden,
  audiosClinicos,
  audioActualJugando,
  ejecutarPlayAudioTabla,
  estudiosAutorizados,
  abrirModuloDictado,
  abrirEditorPaciente,
  handleReabrirFlujoEstudio,
  abrirModalTranscriptor,
  abrirModalFirma 
}) {

  // 🚀 2. Extraemos el usuario DIRECTAMENTE de la memoria
  const { user } = useAuth();

  // 🔒 3. PERFILES DE SEGURIDAD (Blindados contra mayúsculas y variables vacías)
  const userRol = String(user?.rol || "").toLowerCase();
  const currentIdentificador = String(user?.username || user?.nombre || user?.email || "").toUpperCase();
  
  const isSkalo = currentIdentificador.includes("SKALO") || userRol === "superadmin";
  const isAdmin = userRol === "admin" || isSkalo;
  const isRadiologo = userRol === "radiologo" || userRol === "medico";
  
  // Permisos combinados (Quienes pueden usar herramientas clínicas/admin)
  const canUseHerramientasMedicas = isRadiologo || isAdmin;

  // 🌟 4. NUEVO: LECTOR DE LA MATRIZ DE PERMISOS DINÁMICOS
  // Lee cómo vienen los permisos desde tu base de datos (como un array o como un objeto)
  const permisos = user?.permisos || [];
  const tienePermisoDinamicoEditar = Array.isArray(permisos) 
    ? permisos.some(p => p.toUpperCase().includes("EDITAR DATOS")) 
    : !!permisos?.editar_datos_pacientes || !!permisos?.editar_paciente;
  
  // ESTADOS DEL ARRASTRE (Tus funciones isDragging y handleRowMouseDown se mantienen intactas) ...
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true);
  const [lastIndex, setLastIndex] = useState(null);

  useEffect(() => {
    const stopDrag = () => setIsDragging(false);
    window.addEventListener("mouseup", stopDrag);
    return () => window.removeEventListener("mouseup", stopDrag);
  }, []);

  const abrirPDF = (pacienteDbId) => {
    const urlPDF = `http://localhost:8000/api/pacientes/${pacienteDbId}/descargar-pdf`;
    window.open(urlPDF, "_blank");
  };

  const handleCancelarEstudio = async (pacienteId) => {
    const motivo = window.prompt("🛑 ATENCIÓN: Va a abortar este estudio definitivamente.\nPor favor, escriba el motivo clínico o técnico:");
    if (!motivo || motivo.trim() === "") return; 

    try {
      const response = await fetch(`http://localhost:8000/api/pacientes/${pacienteId}/cancelar-estudio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo_cancelacion: motivo })
      });

      if (response.ok) {
        alert("✅ Estudio cancelado y archivado correctamente.");
        window.location.reload(); 
      } else {
        alert("❌ Error al cancelar el estudio en el servidor.");
      }
    } catch (error) {
      console.error(error);
      alert("❌ Error de comunicación con la API.");
    }
  };

  const handleRowMouseDown = (e, index, id) => {
    if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
    if (e.shiftKey && lastIndex !== null) {
      window.getSelection().removeAllRanges(); 
      const start = Math.min(lastIndex, index);
      const end = Math.max(lastIndex, index);
      const rangeIds = pacientes.slice(start, end + 1).map(p => p.id);
      const isSelecting = !seleccionados.includes(id);
      if (isSelecting) {
        const combined = new Set([...seleccionados, ...rangeIds]);
        setSeleccionados(Array.from(combined));
      } else {
        setSeleccionados(seleccionados.filter(sId => !rangeIds.includes(sId)));
      }
      return; 
    }
    const isCurrentlySelected = seleccionados.includes(id);
    const newMode = !isCurrentlySelected; 
    setDragMode(newMode);
    setIsDragging(true);
    setLastIndex(index);
    if (newMode) setSeleccionados(prev => [...prev, id]);
    else setSeleccionados(prev => prev.filter(x => x !== id));
  };

  const handleRowMouseEnter = (index, id) => {
    if (!isDragging) return;
    if (dragMode) setSeleccionados(prev => prev.includes(id) ? prev : [...prev, id]);
    else setSeleccionados(prev => prev.filter(x => x !== id));
  };

  return (
    <table style={styles.tableStyle}>
      {/* ... (Tu THEAD sigue exactamente igual) ... */}
      <thead style={styles.theadStyle}>
        <tr>
          <th style={styles.thStyle}>
            <input type="checkbox" onChange={(e) => setSeleccionados(e.target.checked ? pacientes.map(p => p.id) : [])} checked={pacientes.length > 0 && seleccionados.length === pacientes.length} />
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("estado_pacs")}>ESTADO {renderIconoOrden("estado_pacs")}</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>ID PACIENTE {renderIconoOrden("id")}</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>1ER APELLIDO {renderIconoOrden("paciente")}</th>
          <th style={styles.thStyle}>2DO APELLIDO</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("primer_nombre")}>1ER NOMBRE {renderIconoOrden("primer_nombre")}</th>
          <th style={styles.thStyle}>2DO NOMBRE</th>
          <th style={styles.thStyle}>EMAIL CORREO</th>
          <th style={styles.thStyle}>TELÉFONO / WHATSAPP</th>
          <th style={styles.thStyle}>FLUJO / ADJUNTOS</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>FECHA ESTUDIO {renderIconoOrden("fecha")}</th> 
          <th style={styles.thStyle}>SEXO</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("modalidad")}>MODALIDAD {renderIconoOrden("modalidad")}</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer', color: '#fbbf24' }} onClick={() => solicitarOrdenamiento("descripcion")}>ESTUDIO / PROCEDIMIENTO {renderIconoOrden("descripcion")}</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("departamento")}>DEPTO. {renderIconoOrden("departamento")}</th>
          <th style={styles.thStyle}>ADMIN / EDITAR</th>
          <th style={styles.thStyle}>VISOR</th>
        </tr>
      </thead>
      <tbody>
        {pacientes.length === 0 ? (
          <tr>
            <td colSpan="17" style={styles.waitingState}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📡</div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>No se localizaron registros coincidentes.</p>
            </td>
          </tr>
        ) : (
          pacientes.map((p, index) => {
            const idReal = p.identificacion || p.id_paciente || p.id || "S/I";
            const primerNombre = p.primer_nombre || "";
            const segundoNombre = p.segundo_nombre || "-";
            const primerApellido = p.primer_apellido || "Desconocido";
            const segundoApellido = p.segundo_apellido || "-";
            const emailReal = p.email || "-";
            const telefonoReal = p.telefono || "-";
            const mReal = p.modalidad || p.tipo_estudio || "CR";
            const fechaReal = p.fecha_estudio || p.fecha || "S/F"; 
            const horaReal = p.hora_estudio || "00:00";
            const descripcionReal = p.descripcion || p.study_description || p.procedimiento || "Sin descripción DICOM";

            const estaSeleccionado = seleccionados.includes(p.id);
            const estiloMod = obtenerEstiloModalidad(mReal);
            const estaDesbloqueado = !!estudiosAutorizados[p.id] || p.estado_pacs === "Tomado";
            
            // 🔒 REGLA DE SEGURIDAD MAESTRA PARA EDICIÓN
            const esEstadoInicial = p.estado_pacs === "Importado" || p.estado_pacs === "Tomado" || !p.estado_pacs;
            const estudioAbierto = p.estado_pacs !== "Firmado" && p.estado_pacs !== "Cancelado";
            
            // Lógica: Puede editar si es Médico/Admin, SI es Recepción (solo al inicio), 
            // O SI el superadmin le dio el permiso explícito en la matriz (mientras no esté firmado).
            const canEditPaciente = canUseHerramientasMedicas || 
                                    (userRol === "recepcion" && esEstadoInicial) || 
                                    (tienePermisoDinamicoEditar && estudioAbierto);

            return (
              <tr 
                key={p.id} 
                onMouseDown={(e) => handleRowMouseDown(e, index, p.id)}
                onMouseEnter={() => handleRowMouseEnter(index, p.id)}
                style={{ 
                  ...styles.trStyle, 
                  backgroundColor: estaSeleccionado ? "#1e222b" : p.estado_pacs === "Cancelado" ? "#0f172a" : p.estado_pacs === "Rechazado" ? "#2a1215" : "#111418", 
                  borderLeft: estaSeleccionado ? "4px solid #fbbf24" : p.estado_pacs === "Cancelado" ? "4px solid #475569" : p.estado_pacs === "Rechazado" ? "4px solid #ef4444" : "4px solid transparent",
                  opacity: p.estado_pacs === "Cancelado" ? 0.6 : 1,
                  userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none"
                }}
              >
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={estaSeleccionado} onChange={() => toggleSeleccionarPaciente(p.id)} />
                </td>
                <td style={styles.tdStyle}>
                  <span style={{ 
                    ...styles.badge, 
                    backgroundColor: p.estado_pacs === "Cancelado" ? "#171717" : p.estado_pacs === "Urgencia" ? "#f97316" : p.estado_pacs === "Rechazado" ? "#ef4444" : p.estado_pacs === "Entregado" ? "#a855f7" : p.estado_pacs === "Firmado" ? "#10b981" : p.estado_pacs === "Transcrito" ? "#2563eb" : p.estado_pacs === "Dictado" ? "#d97706" : p.estado_pacs === "Tomado" ? "#3b82f6" : "#475569",
                    border: p.estado_pacs === "Cancelado" ? "1px solid #475569" : "none"
                  }}>
                    {p.estado_pacs || "Importado"}
                  </span>
                </td>
                <td style={styles.tdStyle}>{idReal}</td>
                <td style={styles.tdStyle}><strong>{primerApellido}</strong></td>
                <td style={styles.tdStyle}>{segundoApellido}</td>
                <td style={styles.tdStyle}><strong>{primerNombre}</strong></td>
                <td style={styles.tdStyle}>{segundoNombre}</td>
                <td style={{ ...styles.tdStyle, color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>{emailReal}</td>
                <td style={{ ...styles.tdStyle, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{telefonoReal}</td>
                
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div style={styles.containerFlujo}>
                    {p.estado_pacs === "Cancelado" && (
                      <span style={{ color: "#94a3b8", fontWeight: "bold", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }} title="Estudio abortado por limitaciones técnicas o traslado.">
                        🚫 Archivado
                      </span>
                    )}
                    {p.estado_pacs === "Rechazado" && (
                      <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }} title="El radiólogo solicitó repetir esta imagen por baja calidad.">
                        🛑 Repetir Toma
                      </span>
                    )}
                    {p.estado_pacs === "Urgencia" && canUseHerramientasMedicas && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ color: "#f97316", fontWeight: "bold", fontSize: "13px" }}>🚨 Urgencia</span>
                        <button onClick={() => abrirModuloDictado(p.id)} style={{ padding: "4px 10px", backgroundColor: "#334155", color: "#fff", border: "1px solid #475569", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>🎙️ Oficial</button>
                      </div>
                    )}
                    
                    {/* 🔒 PROTEGIDO: Solo Radiólogo/Admin ven el botón azul de Grabar (o si está bloqueado) */}
                    {(p.estado_pacs === "Importado" || p.estado_pacs === "Tomado") && canUseHerramientasMedicas && (
                      <button onClick={() => abrirModuloDictado(p.id)} style={{ ...styles.iconFlujoBase, color: estaDesbloqueado ? "#10b981" : "#ef4444", backgroundColor: estaDesbloqueado ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.1)", border: estaDesbloqueado ? "1px solid rgba(16, 185, 129, 0.4)" : "1px dashed rgba(239, 68, 68, 0.4)", cursor: estaDesbloqueado ? "pointer" : "not-allowed", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }} title={estaDesbloqueado ? "Abrir Dictador" : "Bloqueado"}>
                        {estaDesbloqueado ? "🎙️ Grabar" : "🔒 Bloqueado"}
                      </button>
                    )}

                    {p.estado_pacs === "Dictado" && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button onClick={() => ejecutarPlayAudioTabla(p.id)} style={{ ...styles.iconFlujoBase, color: "#3b82f6", backgroundColor: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>🔊 Play</button>
                        {/* Asumimos que Recepción no debe transcribir. Si pueden, elimina la condición canUseHerramientasMedicas aquí */}
                        {canUseHerramientasMedicas && (
                          <button onClick={() => abrirModalTranscriptor(p.id)} style={{ padding: "6px 12px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>✍️ Transcribir</button>
                        )}
                      </div>
                    )}
                    {p.estado_pacs === "Transcrito" && canUseHerramientasMedicas && (
                      <button onClick={() => abrirModalFirma(p.id)} style={{ padding: "6px 12px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)" }}>🔏 Validar y Firmar</button>
                    )}
                    {p.estado_pacs === "Firmado" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" }}>✅ Completado</span>
                        <button onClick={() => abrirPDF(p.id)} style={{ padding: "4px 10px", backgroundColor: "#334155", color: "#fff", border: "1px solid #475569", borderRadius: "4px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>📄 Ver PDF</button>
                      </div>
                    )}
                  </div>
                </td>

                <td style={styles.tdStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={styles.fechaBadge}>{fechaReal}</span>
                    <span style={{ fontSize: '0.7rem', color: '#a8a29e', fontWeight: 'bold', fontFamily: 'monospace' }}>🕒 {horaReal}</span>
                  </div>
                </td> 
                <td style={styles.tdStyle}>{p.sexo || "M"}</td>
                <td style={styles.tdStyle}>
                  <span style={{ ...styles.badge, backgroundColor: estiloMod.bg, color: estiloMod.color, border: estiloMod.border, padding: '6px 12px', fontSize: '0.75rem', boxShadow: `0 0 8px ${estiloMod.bg}` }}>{mReal}</span>
                </td>
                
                <td style={{ ...styles.tdStyle, color: '#f8fafc', fontWeight: '500', fontSize: '0.85rem' }}>{descripcionReal}</td>
                <td style={styles.tdStyle}>{p.departamento || "Radiología"}</td>

                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    
                    {/* 🔒 PROTEGIDO: Edición controlada por rol y estado del estudio */}
                    {canEditPaciente && (
                      <button style={styles.btnEditar} onClick={() => abrirEditorPaciente(p)} title="Editar Datos del Paciente">📝</button>
                    )}

                    {/* 🚀 RESTAURADOS Y PROTEGIDOS: Solo Radiólogo/Admin ven Reabrir y Abortar */}
                    {canUseHerramientasMedicas && (
                      <>
                        <button style={{ ...styles.btnEditar, backgroundColor: '#3b82f6', color: '#fff', border: 'none' }} onClick={() => handleReabrirFlujoEstudio(p)} title="Reabrir Flujo / Resetear Estudio">🔄</button>
                        
                        {p.estado_pacs !== "Cancelado" && p.estado_pacs !== "Firmado" && (
                          <button style={{ ...styles.btnEditar, backgroundColor: '#ef4444', color: '#fff', border: 'none' }} onClick={() => handleCancelarEstudio(p.id)} title="Abortar/Cancelar Estudio Definitivamente">🛑</button>
                        )}
                      </>
                    )}

                  </div>
                </td>

                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <button style={styles.btnVisor}>ABRIR</button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}