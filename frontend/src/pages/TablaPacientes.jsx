import React, { useState, useEffect } from "react";
import { obtenerEstiloModalidad } from "./modalidades";
import { styles } from "./pacientesStyles"; 
import { useAuth } from "../AuthContext"; 

export default function TablaPacientes({
  pacientes, seleccionados, setSeleccionados, toggleSeleccionarPaciente, solicitarOrdenamiento,
  renderIconoOrden, audiosClinicos, audioActualJugando, ejecutarPlayAudioTabla, estudiosAutorizados,
  abrirModuloDictado, abrirEditorPaciente, handleReabrirFlujoEstudio, abrirModalTranscriptor, abrirModalFirma,
  handleMarcarTomado 
}) {

  const { user } = useAuth();

  const userRol = String(user?.rol || "").toLowerCase().trim();
  const currentIdentificador = String(user?.username || user?.nombre || user?.email || "").toUpperCase();
  
  const isSkalo = currentIdentificador.includes("SKALO") || userRol === "superadmin";
  const isAdmin = userRol === "admin" || userRol === "it_biomedica" || isSkalo;
  const isRadiologo = userRol === "radiologo" || userRol.startsWith("medico");
  const canUseHerramientasMedicas = isRadiologo || isAdmin;

  // 🔥 RUTA DINÁMICA: Detecta si estamos en desarrollo o en la red del hospital
  const apiBase = window.location.origin.includes(":5173") 
    ? "http://localhost:8000" 
    : window.location.origin;

  let tienePermisoDinamicoEditar = false;
  try {
    const permisos = user?.permisos || [];
    if (Array.isArray(permisos)) {
      tienePermisoDinamicoEditar = permisos.some(p => typeof p === "string" && p.toUpperCase().includes("EDITAR"));
    } else {
      tienePermisoDinamicoEditar = !!permisos?.editar_datos_pacientes || !!permisos?.editar_paciente;
    }
  } catch (error) {
    console.warn("Aviso: Matriz de permisos estructurada de forma diferente.");
  }
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true);
  const [lastIndex, setLastIndex] = useState(null);

  useEffect(() => {
    const stopDrag = () => setIsDragging(false);
    window.addEventListener("mouseup", stopDrag);
    return () => window.removeEventListener("mouseup", stopDrag);
  }, []);

  // 🔥 ACTUALIZADO: URL Dinámica
  const abrirPDF = (estudioId) => window.open(`${apiBase}/api/pacientes/estudio/${estudioId}/descargar-pdf`, "_blank");

  const abrirVisorMedico = (estudioId, idReal) => {
    window.open(
      `/imagenes-estudio/${estudioId}?id_real=${idReal}`, 
      `Visor_${estudioId}`, 
      `width=1200,height=900,top=50,left=100,resizable=yes`
    );
  };

  // 🔥 ACTUALIZADO: URL Dinámica
  const handleCancelarEstudio = async (estudioId) => {
    const motivo = window.prompt("🛑 ATENCIÓN: Va a abortar este estudio.\nMotivo clínico/técnico:");
    if (!motivo || motivo.trim() === "") return; 
    try {
      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/cancelar-estudio`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo_cancelacion: motivo })
      });
      if (response.ok) { alert("✅ Estudio cancelado."); window.location.reload(); } 
      else { alert("❌ Error al cancelar el estudio."); }
    } catch (error) { alert("❌ Error de comunicación con la API."); }
  };

const handleEnvioManual = async (tipoMetodo, estudioId, idReal, destino) => {
    if (!destino || destino === "-" || destino.trim() === "") {
      return alert(`❌ Faltan datos para envío. Por favor, edite el paciente y agregue su ${tipoMetodo}.`);
    }
    
    if (!window.confirm(`📤 ¿Confirmar envío automatizado por ${tipoMetodo} al destino: ${destino}?`)) return;
    
    try {
      const token = localStorage.getItem("token")?.replace(/['"]+/g, '');

      // ==========================================
      // 1. PASARELA WHATSAPP
      // ==========================================
      if (tipoMetodo === 'WhatsApp') {
        const response = await fetch(`${apiBase}/api/whatsapp/enviar-estudio/${estudioId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            telefono: destino,
            formato: "link"
          })
        });

        if (!response.ok) throw new Error((await response.json()).detail || "Error en pasarela de WhatsApp");
        alert(`✅ WhatsApp enviado con éxito al ${destino} y registrado en la bitácora.`);
      } 
      // ==========================================
      // 2. PASARELA EMAIL (Con Enlace Seguro del Visor)
      // ==========================================
      else if (tipoMetodo === 'Email') {
        // A) Generamos el enlace seguro primero
        const linkRes = await fetch(`${apiBase}/api/secure-links/generar/${estudioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        
        let urlSegura = "";
        if (linkRes.ok) {
          const data = await linkRes.json();
          urlSegura = `${apiBase}/portal/${data.link}`;
          console.log("🔗 Link generado con éxito:", urlSegura); 
        } else {
          console.error("❌ Falló la generación del link de seguridad.");  
        }

        // B) Despachamos el correo con el PDF y el Enlace
        const response = await fetch(`${apiBase}/api/email/enviar-estudio/${estudioId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            email: destino,
            enlace_visor: urlSegura 
          })
        });

        if (!response.ok) throw new Error((await response.json()).detail || "Error en el servidor de correos");
        alert(`✅ Correo enviado silenciosamente con éxito a ${destino}`);
      }

      // ==========================================
      // 3. PASARELA SMS (Mantiene su flujo manual original)
      // ==========================================
      else if (tipoMetodo === 'SMS') {
        const linkRes = await fetch(`${apiBase}/api/secure-links/generar/${estudioId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        
        if (!linkRes.ok) throw new Error("No se pudo generar el token de seguridad");
        
        const data = await linkRes.json();
        const urlSegura = `${apiBase}/portal/${data.link}`;      
        const mensaje = `Hola. Clínica Asotrauma le informa que sus imágenes radiológicas ya están disponibles.\n\nPara visualizarlas, ingrese al siguiente enlace y escriba su Fecha de Nacimiento (DíaMesAño) por seguridad. Válido por 48 horas:\n\n${urlSegura}\n\nGracias por confiar en nosotros.`;

        const urlSms = `sms:${destino.replace(/\D/g, '')}?body=${encodeURIComponent(mensaje)}`;
        window.location.href = urlSms;
      }
    } catch (error) { 
      console.error(error);
      alert(`❌ Fallo en el envío: ${error.message}`); 
    }
  };

  const handleRowMouseDown = (e, index, estudioId) => {
    if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
    if (e.shiftKey && lastIndex !== null) {
      window.getSelection().removeAllRanges(); 
      const start = Math.min(lastIndex, index), end = Math.max(lastIndex, index);
      const rangeIds = pacientes.slice(start, end + 1).map(p => p.estudio_interno_id);
      if (!seleccionados.includes(estudioId)) { setSeleccionados(Array.from(new Set([...seleccionados, ...rangeIds]))); } 
      else { setSeleccionados(seleccionados.filter(sId => !rangeIds.includes(sId))); }
      return; 
    }
    const newMode = !seleccionados.includes(estudioId); 
    setDragMode(newMode); setIsDragging(true); setLastIndex(index);
    if (newMode) setSeleccionados(prev => [...prev, estudioId]); else setSeleccionados(prev => prev.filter(x => x !== estudioId));
  };

  const handleRowMouseEnter = (index, estudioId) => {
    if (!isDragging) return;
    if (dragMode) setSeleccionados(prev => prev.includes(estudioId) ? prev : [...prev, estudioId]);
    else setSeleccionados(prev => prev.filter(x => x !== estudioId));
  };

  return (
    <table style={styles.tableStyle}>
      <thead style={styles.theadStyle}>
        <tr>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}><input type="checkbox" onChange={(e) => setSeleccionados(e.target.checked ? pacientes.map(p => p.estudio_interno_id) : [])} checked={pacientes.length > 0 && seleccionados.length === pacientes.length} /></th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("estado_pacs")}>ESTADO {renderIconoOrden("estado_pacs")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>ID PACIENTE {renderIconoOrden("id")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>1ER APELLIDO {renderIconoOrden("paciente")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>2DO APELLIDO</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("primer_nombre")}>1ER NOMBRE {renderIconoOrden("primer_nombre")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>2DO NOMBRE</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>EMAIL CORREO</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>TELÉFONO / WHATSAPP</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>FLUJO / ADJUNTOS</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>FECHA {renderIconoOrden("fecha")}</th> 
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>SEXO</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("modalidad")}>MOD {renderIconoOrden("modalidad")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer', color: '#fbbf24' }} onClick={() => solicitarOrdenamiento("descripcion")}>ESTUDIO {renderIconoOrden("descripcion")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap", cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("departamento")}>DEPTO {renderIconoOrden("departamento")}</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>ADMIN / EDITAR</th>
          <th style={{ ...styles.thStyle, padding: "16px 12px", whiteSpace: "nowrap" }}>VISOR</th>
        </tr>
      </thead>
<tbody>
        {(!pacientes || pacientes.length === 0) ? (
          <tr>
            <td colSpan="17" style={styles.waitingState}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📡</div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>No se localizaron registros coincidentes.</p>
            </td>
          </tr>
        ) : (
          pacientes.map((p, index) => {
            const idReal = p.identificacion || p.id_paciente || p.id || "S/I";
            const primerNombre = p.primer_nombre || ""; const segundoNombre = p.segundo_nombre || "-";
            const primerApellido = p.primer_apellido || "Desconocido"; const segundoApellido = p.segundo_apellido || "-";
            const emailReal = p.email || "-"; const telefonoReal = p.telefono || "-";
            const mReal = p.modalidad || p.tipo_estudio || "CR";
            const fechaReal = p.fecha_estudio || p.fecha || "S/F"; const horaReal = p.hora_estudio || "00:00";
            const descripcionReal = p.descripcion || p.study_description || p.procedimiento || "Sin descripción";

            const estaSeleccionado = seleccionados.includes(p.estudio_interno_id);
            const estiloMod = obtenerEstiloModalidad(mReal);
            const estaDesbloqueado = !!estudiosAutorizados[p.estudio_interno_id] || p.estado_pacs === "Tomado";

            const esEstadoInicial = p.estado_pacs === "Importado" || p.estado_pacs === "Tomado" || !p.estado_pacs;
            const estudioAbierto = p.estado_pacs !== "Firmado" && p.estado_pacs !== "Cancelado";
            const canEditPaciente = canUseHerramientasMedicas || ((userRol === "recepcion" || userRol === "tecnologo") && esEstadoInicial) || (tienePermisoDinamicoEditar && estudioAbierto);

            // 🧠 LÓGICA DE VISUALIZACIÓN IA (TRIAGE AUTOMÁTICO)
            const esCritico = p.prioridad_ia === "CRITICO";
            const esUrgente = p.prioridad_ia === "URGENTE";
            const esNormal = p.prioridad_ia === "NORMAL";
            
            const estadoActivo = p.estado_pacs !== "Firmado" && p.estado_pacs !== "Cancelado";
            const yaPasoPorIA = p.estado_pacs !== "Importado"; // Para no pintar de verde los que aún no han sido validados por el tecnólogo

            // Determinar colores de la fila (Priorizando selecciones manuales y bloqueos)
            let bgColor = "#111418";
            let borderL = "4px solid transparent";

            if (estaSeleccionado) {
              bgColor = "#1e222b"; borderL = "4px solid #fbbf24";
            } else if (p.estado_pacs === "Cancelado") {
              bgColor = "#0f172a"; borderL = "4px solid #475569";
            } else if (p.estado_pacs === "Rechazado") {
              bgColor = "#2a1215"; borderL = "4px solid #ef4444";
            } else if (esCritico && estadoActivo) {
              bgColor = "rgba(239, 68, 68, 0.15)"; borderL = "4px solid #ef4444"; // 🚨 Alerta Roja
            } else if (esUrgente && estadoActivo) {
              bgColor = "rgba(249, 115, 22, 0.15)"; borderL = "4px solid #f97316"; // ⚠️ Alerta Naranja
            } else if (esNormal && estadoActivo && yaPasoPorIA) {
              bgColor = "rgba(16, 185, 129, 0.06)"; borderL = "4px solid #10b981"; // 🟢 Verde Suave (IA validó)
            }

            return (
              <tr key={p.estudio_interno_id} onMouseDown={(e) => handleRowMouseDown(e, index, p.estudio_interno_id)} onMouseEnter={() => handleRowMouseEnter(index, p.estudio_interno_id)} style={{ ...styles.trStyle, backgroundColor: bgColor, borderLeft: borderL, opacity: p.estado_pacs === "Cancelado" ? 0.6 : 1, userSelect: "none" }}>
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={estaSeleccionado} onChange={() => toggleSeleccionarPaciente(p.estudio_interno_id)} />
                </td>
                <td style={styles.tdStyle}><span style={{ ...styles.badge, backgroundColor: p.estado_pacs === "Cancelado" ? "#171717" : p.estado_pacs === "Urgencia" ? "#f97316" : p.estado_pacs === "Rechazado" ? "#ef4444" : p.estado_pacs === "Entregado" ? "#a855f7" : p.estado_pacs === "Firmado" ? "#10b981" : p.estado_pacs === "Transcrito" ? "#2563eb" : p.estado_pacs === "Dictado" ? "#d97706" : p.estado_pacs === "Tomado" ? "#3b82f6" : "#475569", border: p.estado_pacs === "Cancelado" ? "1px solid #475569" : "none" }}>{p.estado_pacs || "Importado"}</span></td>
                <td style={styles.tdStyle}>{idReal}</td>
                <td style={styles.tdStyle}><strong>{primerApellido}</strong></td>
                <td style={styles.tdStyle}>{segundoApellido}</td>
                <td style={styles.tdStyle}><strong>{primerNombre}</strong></td>
                <td style={styles.tdStyle}>{segundoNombre}</td>
                <td style={{ ...styles.tdStyle, color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>{emailReal}</td>
                <td style={{ ...styles.tdStyle, color: '#fbbf24', fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{telefonoReal}</td>
                
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div style={styles.containerFlujo}>
                    {p.estado_pacs === "Cancelado" && (<span style={{ color: "#94a3b8", fontWeight: "bold", fontSize: "12px", display: "flex", gap: "6px" }}>🚫 Archivado</span>)}
                    {p.estado_pacs === "Rechazado" && (<span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "13px", display: "flex", gap: "6px" }}>🛑 Repetir Toma</span>)}
                    
                    {userRol === 'tecnologo' && (p.estado_pacs === 'Importado' || p.estado_pacs === 'Pendiente' || !p.estado_pacs) && (
                        <button
                            onClick={() => handleMarcarTomado(p.estudio_interno_id)}
                            style={{ background: "#10b981", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)" }}
                            title="Validar paciente y asignar a mis métricas"
                        >
                            ✔ Validar Estudio
                        </button>
                    )}

                    {p.estado_pacs === "Urgencia" && canUseHerramientasMedicas && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "#f97316", fontWeight: "bold", fontSize: "13px" }}>🚨 Urgencia</span><button onClick={() => abrirModuloDictado(p.estudio_interno_id)} style={{ padding: "4px 10px", backgroundColor: "#334155", color: "#fff", border: "1px solid #475569", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>🎙️ Oficial</button></div>
                    )}
                    {(p.estado_pacs === "Importado" || p.estado_pacs === "Tomado") && canUseHerramientasMedicas && (
                      <button onClick={() => abrirModuloDictado(p.estudio_interno_id)} style={{ ...styles.iconFlujoBase, color: estaDesbloqueado ? "#10b981" : "#ef4444", backgroundColor: estaDesbloqueado ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.1)", border: estaDesbloqueado ? "1px solid rgba(16, 185, 129, 0.4)" : "1px dashed rgba(239, 68, 68, 0.4)", cursor: estaDesbloqueado ? "pointer" : "not-allowed", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>{estaDesbloqueado ? "🎙️ Grabar" : "🔒 Bloqueado"}</button>
                    )}
                    {p.estado_pacs === "Dictado" && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button onClick={() => ejecutarPlayAudioTabla(p.estudio_interno_id)} style={{ ...styles.iconFlujoBase, color: "#3b82f6", backgroundColor: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", cursor: "pointer", padding: "6px 12px", borderRadius: "4px", fontWeight: "bold", display: "flex", gap: "6px" }}>🔊 Play</button>
                        {(canUseHerramientasMedicas || userRol === "transcriptor") && (<button onClick={() => abrirModalTranscriptor(p.estudio_interno_id)} style={{ padding: "6px 12px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>✍️ Transcribir</button>)}
                      </div>
                    )}
                    {p.estado_pacs === "Transcrito" && canUseHerramientasMedicas && (<button onClick={() => abrirModalFirma(p.estudio_interno_id)} style={{ padding: "6px 12px", backgroundColor: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)" }}>🔏 Validar y Firmar</button>)}
                    {p.estado_pacs === "Firmado" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", display: "flex", gap: "4px" }}>✅ Completado</span>
                        <button onClick={() => abrirPDF(p.estudio_interno_id)} style={{ padding: "4px 10px", backgroundColor: "#334155", color: "#fff", border: "1px solid #475569", borderRadius: "4px", cursor: "pointer", fontSize: "12px", display: "flex", gap: "4px" }}>📄 PDF</button>
                        {(userRol === "recepcion" || isAdmin) && (
                          <>
                            <button onClick={() => handleEnvioManual('WhatsApp', p.estudio_interno_id, idReal, telefonoReal)} style={{ padding: "4px 8px", backgroundColor: "#25D366", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>📱 WA</button>
                            <button onClick={() => handleEnvioManual('Email', p.estudio_interno_id, idReal, emailReal)} style={{ padding: "4px 8px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>✉️ Email</button>
                            {import.meta.env.VITE_HABILITAR_SMS === "true" && (
                            <button onClick={() => handleEnvioManual('SMS', p.estudio_interno_id, idReal, telefonoReal)} style={{ padding: "4px 8px", backgroundColor: "#8b5cf6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>💬 SMS</button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                <td style={styles.tdStyle}><div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={styles.fechaBadge}>{fechaReal}</span><span style={{ fontSize: '0.7rem', color: '#a8a29e', fontWeight: 'bold', fontFamily: 'monospace' }}>🕒 {horaReal}</span></div></td> 
                <td style={styles.tdStyle}>{p.sexo || "M"}</td>
                <td style={styles.tdStyle}><span style={{ ...styles.badge, backgroundColor: estiloMod.bg, color: estiloMod.color, border: estiloMod.border, padding: '6px 12px', fontSize: '0.75rem', boxShadow: `0 0 8px ${estiloMod.bg}` }}>{mReal}</span></td>
                
                {/* 🔥 CELDA CON EL DISTINTIVO VISUAL DE IA 🔥 */}
                <td style={{ ...styles.tdStyle, color: '#f8fafc', fontWeight: '500', fontSize: '0.85rem' }}>
                  {esCritico && estadoActivo && <span title="¡ALERTA IA: Posible patología crítica!" style={{ marginRight: '6px', fontSize: '1.2rem' }}>🚨</span>}
                  {esUrgente && estadoActivo && <span title="¡AVISO IA: Posible urgencia!" style={{ marginRight: '6px', fontSize: '1.2rem' }}>⚠️</span>}
                  {esNormal && estadoActivo && yaPasoPorIA && <span title="IA: Estudio sin hallazgos críticos evidentes" style={{ marginRight: '6px', fontSize: '1.2rem' }}>🟢</span>}
                  {descripcionReal}
                </td>
                
                <td style={styles.tdStyle}>{p.departamento || "Radiología"}</td>

                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canEditPaciente && (<button style={styles.btnEditar} onClick={() => abrirEditorPaciente(p)} title="Editar Datos">📝</button>)}
                    {canUseHerramientasMedicas && (
                      <>
                        <button style={{ ...styles.btnEditar, backgroundColor: '#3b82f6', color: '#fff', border: 'none' }} onClick={() => handleReabrirFlujoEstudio(p)} title="Reabrir Flujo">🔄</button>
                        {p.estado_pacs !== "Cancelado" && p.estado_pacs !== "Firmado" && (<button style={{ ...styles.btnEditar, backgroundColor: '#ef4444', color: '#fff', border: 'none' }} onClick={() => handleCancelarEstudio(p.estudio_interno_id)} title="Abortar">🛑</button>)}
                      </>
                    )}
                  </div>
                </td>
                
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <button style={styles.btnVisor} onClick={() => abrirVisorMedico(p.estudio_interno_id, idReal)}>ABRIR</button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}