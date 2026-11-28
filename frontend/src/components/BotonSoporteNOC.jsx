import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./BotonSoporteNOC.css";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE = isLocalhost
  ? "http://192.168.5.21:8000"
  : import.meta.env.VITE_API_URL || window.API_URL || window.location.origin;

export default function BotonSoporteNOC() {
  const { i18n } = useTranslation();
  const isEn = (i18n.language || localStorage.getItem("i18nextLng") || "es")
    .toLowerCase()
    .startsWith("en");

  const [abierto, setAbierto] = useState(false);
  const [modulo, setModulo] = useState("VISOR_MPR3D");
  const [prioridad, setPrioridad] = useState("ALTA");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const recolectarDiagnosticoCliente = () => {
    let gpuInfo = "N/A";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (gl) {
        const max3d = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
        const renderer = gl.getParameter(gl.RENDERER);
        gpuInfo = `WebGL2 OK | MAX_3D_TEX=${max3d} | ${renderer}`;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } else {
        gpuInfo = "WebGL2 DISABLED";
      }
    } catch (e) {}

    return {
      url: window.location.href,
      idioma: isEn ? "en" : "es",
      userAgent: navigator.userAgent,
      resolucion: `${window.innerWidth}x${window.innerHeight}`,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      gpu: gpuInfo,
    };
  };

  const enviarLlamada = async (e) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    setEnviando(true);
    setResultado(null);

    try {
      const rawToken =
        localStorage.getItem("access_token") || localStorage.getItem("token") || "";
      const token = rawToken.replace(/['"]+/g, "").trim();

      const res = await fetch(`${API_BASE}/api/noc/solicitar-soporte`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          modulo,
          prioridad,
          descripcion,
          diagnostico_cliente: recolectarDiagnosticoCliente(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error enviando solicitud");

      setResultado({ ok: true, codigo: data.codigo_ticket });
      setDescripcion("");
    } catch (err) {
      setResultado({ ok: false, error: err.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResultado(null);
          setAbierto(true);
        }}
        className="noc-support-trigger"
        title={isEn ? "Call MI_PACS Remote Help Desk" : "Llamar a Mesa de Ayuda MI_PACS"}
      >
        <span>🎧</span>
        <span>{isEn ? "Help Desk" : "Mesa de Ayuda"}</span>
      </button>

      {abierto && (
        <div className="noc-support-backdrop" onClick={() => setAbierto(false)}>
          <div className="noc-support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="noc-support-header">
              <span className="noc-support-title">
                🛰️ {isEn ? "MI_PACS Central — Remote Help Desk" : "Central MI_PACS — Soporte Remoto"}
              </span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="noc-support-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={enviarLlamada} className="noc-support-form">
              <div className="noc-support-grid">
                <div>
                  <label className="noc-support-label">
                    {isEn ? "Affected Module" : "Módulo Afectado"}
                  </label>
                  <select
                    value={modulo}
                    onChange={(e) => setModulo(e.target.value)}
                    className="noc-support-input"
                  >
                    <option value="VISOR_MPR3D">Visor MPR 3D / 2D</option>
                    <option value="DICOM_SCP">Recepción Modalidades (DICOM)</option>
                    <option value="RIS_AGENDA">RIS / Agenda / Informes</option>
                    <option value="NAS_BACKUP">Almacenamiento NAS / Respaldos</option>
                    <option value="RED_TUNEL">Conectividad / Acceso Remoto</option>
                  </select>
                </div>

                <div>
                  <label className="noc-support-label">
                    {isEn ? "Urgency" : "Prioridad"}
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value)}
                    className="noc-support-input"
                  >
                    <option value="MEDIA">{isEn ? "Medium" : "Media"}</option>
                    <option value="ALTA">{isEn ? "High" : "Alta"}</option>
                    <option value="CRITICA">{isEn ? "Critical (Emergency)" : "Crítica (Urgencia)"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="noc-support-label">
                  {isEn ? "Describe the issue:" : "Describe la falla o solicitud:"}
                </label>
                <textarea
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder={
                    isEn
                      ? "E.g., Chest CT volume takes too long to open in 3D..."
                      : "Ej. El estudio de tórax no carga en reconstrucción 3D..."
                  }
                  className="noc-support-input noc-support-textarea"
                />
              </div>

              <div className="noc-support-note">
                🛡️{" "}
                {isEn
                  ? "System telemetry, NAS status, and WebGL diagnostics will be attached automatically."
                  : "Se adjuntará automáticamente el diagnóstico técnico del servidor, estado del NAS y GPU."}
              </div>

              {resultado?.ok && (
                <div className="noc-support-success">
                  ✅ {isEn ? "Ticket registered at Central NOC:" : "Ticket registrado en la Central NOC:"}{" "}
                  <strong>{resultado.codigo}</strong>
                </div>
              )}

              {resultado && !resultado.ok && (
                <div className="noc-support-error">⚠️ {resultado.error}</div>
              )}

              <div className="noc-support-actions">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="noc-support-btn-cancel"
                >
                  {isEn ? "Close" : "Cerrar"}
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="noc-support-btn-send"
                >
                  {enviando
                    ? isEn
                      ? "Sending..."
                      : "Enviando..."
                    : isEn
                      ? "Send Help Request"
                      : "Enviar Llamada a Central"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}