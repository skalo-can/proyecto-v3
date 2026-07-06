import React from "react";
import { obtenerEstiloModalidad } from "./modalidades";
import { styles } from "./pacientesStyles"; // Se importarán desde el archivo de estilos centralizado

export default function TablaPacientes({
  pacientes,
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

  // 🚀 NUEVA FUNCIÓN: Abrir el PDF en una nueva pestaña
  const abrirPDF = (idReal) => {
    // Apunta a la carpeta estática del backend que expusimos en main.py
    const urlPDF = `http://localhost:8000/static/pdf_reports/Reporte_${idReal}.pdf`;
    window.open(urlPDF, "_blank", "noopener,noreferrer");
  };

  return (
    <table style={styles.tableStyle}>
      <thead style={styles.theadStyle}>
        <tr>
          <th style={styles.thStyle}>
            <input 
              type="checkbox" 
              onChange={(e) => setSeleccionados(e.target.checked ? pacientes.map(p => p.id) : [])} 
              checked={pacientes.length > 0 && seleccionados.length === pacientes.length} 
            />
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("estado_pacs")}>
            ESTADO {renderIconoOrden("estado_pacs")}
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>
            ID PACIENTE {renderIconoOrden("id")}
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>
            1ER APELLIDO {renderIconoOrden("paciente")}
          </th>
          <th style={styles.thStyle}>2DO APELLIDO</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("primer_nombre")}>
            1ER NOMBRE {renderIconoOrden("primer_nombre")}
          </th>
          <th style={styles.thStyle}>2DO NOMBRE</th>
          <th style={styles.thStyle}>EMAIL CORREO</th>
          <th style={styles.thStyle}>TELÉFONO / WHATSAPP</th>
          <th style={styles.thStyle}>FLUJO / ADJUNTOS</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>
            FECHA ESTUDIO {renderIconoOrden("fecha")}
          </th> 
          <th style={styles.thStyle}>SEXO</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("modalidad")}>
            MODALIDAD {renderIconoOrden("modalidad")}
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("departamento")}>
            DEPTO. {renderIconoOrden("departamento")}
          </th>
          <th style={styles.thStyle}>EDITAR</th>
          <th style={styles.thStyle}>VISOR</th>
        </tr>
      </thead>
      <tbody>
        {pacientes.length === 0 ? (
          <tr>
            <td colSpan="16" style={styles.waitingState}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📡</div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>No se localizaron registros coincidentes.</p>
            </td>
          </tr>
        ) : (
          pacientes.map((p) => {
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

            const estaSeleccionado = seleccionados.includes(p.id);
            const estiloMod = obtenerEstiloModalidad(mReal);

            const estaDesbloqueado = !!estudiosAutorizados[p.id] || p.estado_pacs === "Tomado";

            return (
              <tr 
                key={p.id} 
                onClick={() => toggleSeleccionarPaciente(p.id)}
                style={{ 
                  ...styles.trStyle, 
                  backgroundColor: estaSeleccionado ? "#1e222b" : "#111418",
                  borderLeft: estaSeleccionado ? "4px solid #fbbf24" : "4px solid transparent"
                }}
              >
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={estaSeleccionado} 
                    onChange={() => toggleSeleccionarPaciente(p.id)} 
                  />
                </td>
                <td style={styles.tdStyle}>
                  <span style={{ 
                    ...styles.badge, 
                    backgroundColor: 
                      p.estado_pacs === "Entregado" ? "#a855f7" : 
                      p.estado_pacs === "Firmado" ? "#10b981" : 
                      p.estado_pacs === "Transcrito" ? "#2563eb" : 
                      p.estado_pacs === "Dictado" ? "#d97706" : 
                      p.estado_pacs === "Tomado" ? "#3b82f6" : "#475569"
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
                
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.containerFlujo}>
                    {/* 🛡️ CONTROL DE ACCIONES SEPARADO Y BLINDADO POR ESTADO REAL */}
                    
                    {/* ESTADO 1: PACIENTE DISPONIBLE PARA GRABACIÓN */}
                    {(p.estado_pacs === "Importado" || p.estado_pacs === "Tomado") && (
                      <button 
                        onClick={() => abrirModuloDictado(p.id)}
                        style={{
                          ...styles.iconFlujoBase, 
                          // 🔥 LÓGICA VISUAL DINÁMICA (VERDE = LISTO, ROJO = BLOQUEADO)
                          color: estaDesbloqueado ? "#10b981" : "#ef4444", 
                          backgroundColor: estaDesbloqueado ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.1)", 
                          border: estaDesbloqueado ? "1px solid rgba(16, 185, 129, 0.4)" : "1px dashed rgba(239, 68, 68, 0.4)", 
                          cursor: estaDesbloqueado ? "pointer" : "not-allowed",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.3s ease" // Transición suave al autorizar
                        }}
                        title={estaDesbloqueado ? "Abrir Dictador en Pantalla Secundaria" : "Estudio Bloqueado. Requiere Autorización (Botón Azul 🔄)"}
                      >
                        {estaDesbloqueado ? "🎙️ Grabar" : "🔒 Bloqueado"}
                      </button>
                    )}

                    {/* ESTADO 2: PACIENTE YA DICTADO */}
                    {p.estado_pacs === "Dictado" && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button 
                          onClick={() => ejecutarPlayAudioTabla(p.id)}
                          style={{
                            ...styles.iconFlujoBase, 
                            color: "#3b82f6", 
                            backgroundColor: "rgba(59,130,246,0.15)", 
                            border: "1px solid rgba(59,130,246,0.3)", 
                            cursor: "pointer",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                          title="Reproducir Dictado del Médico"
                        >
                          🔊 Play
                        </button>
                        
                        <button 
                          onClick={() => abrirModalTranscriptor(p.id)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#8b5cf6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "bold"
                          }}
                        >
                          ✍️ Transcribir
                        </button>
                      </div>
                    )}

                    {/* ESTADO 3: PACIENTE YA TRANSCRITO */}
                    {p.estado_pacs === "Transcrito" && (
                      <button 
                        onClick={() => abrirModalFirma(p.id)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          boxShadow: "0 0 10px rgba(16, 185, 129, 0.3)"
                        }}
                      >
                        🔏 Validar y Firmar
                      </button>
                    )}

                    {/* ESTADO 4: PACIENTE FIRMADO (Ciclo cerrado + Botón PDF) */}
                    {p.estado_pacs === "Firmado" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
                          ✅ Completado
                        </span>
                        
                        {/* 🚀 BOTÓN VISOR PDF INYECTADO AQUÍ */}
                        <button 
                          onClick={() => abrirPDF(idReal)}
                          style={{
                            padding: "4px 10px",
                            backgroundColor: "#334155",
                            color: "#fff",
                            border: "1px solid #475569",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "background-color 0.2s"
                          }}
                          title="Ver Reporte PDF"
                          onMouseEnter={(e) => e.target.style.backgroundColor = "#475569"}
                          onMouseLeave={(e) => e.target.style.backgroundColor = "#334155"}
                        >
                          📄 Ver PDF
                        </button>
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
                  <span style={{
                    ...styles.badge,
                    backgroundColor: estiloMod.bg,
                    color: estiloMod.color,
                    border: estiloMod.border,
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    boxShadow: `0 0 8px ${estiloMod.bg}` 
                  }}>
                    {mReal}
                  </span>
                </td>
                <td style={styles.tdStyle}>{p.departamento || "Radiología"}</td>
                
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={styles.btnEditar} onClick={() => abrirEditorPaciente(p)}>📝</button>
                    <button style={styles.btnReabrir} onClick={() => handleReabrirFlujoEstudio(p)}>🔄</button>
                  </div>
                </td>
                <td style={styles.tdStyle} onClick={(e) => e.stopPropagation()}>
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