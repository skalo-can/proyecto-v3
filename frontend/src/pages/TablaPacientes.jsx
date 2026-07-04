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
  handleReabrirFlujoEstudio
}) {
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
          <th style={styles.thStyle}>ESTADO</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("id")}>
            ID PACIENTE {renderIconoOrden("id")}
          </th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("paciente")}>
            1ER APELLIDO {renderIconoOrden("paciente")}
          </th>
          <th style={styles.thStyle}>2DO APELLIDO</th>
          <th style={styles.thStyle}>1ER NOMBRE</th>
          <th style={styles.thStyle}>2DO NOMBRE</th>
          <th style={styles.thStyle}>EMAIL CORREO</th>
          <th style={styles.thStyle}>TELÉFONO / WHATSAPP</th>
          <th style={styles.thStyle}>FLUJO / ADJUNTOS</th>
          <th style={{ ...styles.thStyle, cursor: 'pointer' }} onClick={() => solicitarOrdenamiento("fecha")}>
            FECHA ESTUDIO {renderIconoOrden("fecha")}
          </th> 
          <th style={styles.thStyle}>SEXO</th>
          <th style={styles.thStyle}>MODALIDAD</th>
          <th style={styles.thStyle}>DEPTO.</th>
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
            const habilitadoParaDictado = !!estudiosAutorizados[p.id] || p.estado_pacs === "Tomado";
            const estiloMod = obtenerEstiloModalidad(mReal);

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
                    <button 
                      onClick={() => ejecutarPlayAudioTabla(p.id)}
                      style={{
                        ...styles.iconFlujoBase,
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
                      onClick={() => abrirModuloDictado(p.id)}
                      style={{
                        ...styles.iconFlujoBase, 
                        color: !habilitadoParaDictado ? "#475569" : (flujo.tiene_audio ? "#3b82f6" : "#ef4444"), 
                        backgroundColor: !habilitadoParaDictado ? "transparent" : (flujo.tiene_audio ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.1)"), 
                        border: !habilitadoParaDictado ? "1px solid transparent" : (flujo.tiene_audio ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(239,68,68,0.2)"), 
                        cursor: habilitadoParaDictado ? "pointer" : "not-allowed",
                        opacity: habilitadoParaDictado ? 1 : 0.35
                      }}
                    >
                      📝
                    </button>
                    <span style={{...styles.iconFlujoBase, color: flujo.esta_firmado ? "#10b981" : "#475569", opacity: flujo.esta_firmado ? 1 : 0.3}}>✍️</span>
                    <span style={{...styles.iconFlujoBase, color: flujo.tiene_anexos ? "#a855f7" : "#475569", opacity: flujo.tiene_anexos ? 1 : 0.3}}>📎</span>
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