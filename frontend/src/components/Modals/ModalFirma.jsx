import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../AuthContext";

export default function ModalFirma({
  isEmbedded = false,
  estudioIdProps = null,
  modoProps = null,
  onCerrar = null,
}) {
  const { estudioId: paramEstudioId } = useParams();
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const estudioId = estudioIdProps || paramEstudioId;
  const isEn = i18n.language?.startsWith("en");
  const isAutoDictado =
    modoProps === "autodictado" ||
    new URLSearchParams(window.location.search).get("modo") === "autodictado";

  // Idioma en que habla el médico vs. Idioma en que se escribe el reporte
  const [idiomaDictado, setIdiomaDictado] = useState(isEn ? "en" : "es");
  const [idiomaReporte, setIdiomaReporte] = useState(isEn ? "en" : "es");

  const [reporteTexto, setReporteTexto] = useState("");
  const [nombreMedico, setNombreMedico] = useState("");
  const [registroMedico, setRegistroMedico] = useState("");
  const [estaGenerandoPdf, setEstaGenerandoPdf] = useState(false);

  const [aprobado, setAprobado] = useState(null);
  const [notaRechazo, setNotaRechazo] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  const [datosMedicoLogueado, setDatosMedicoLogueado] = useState({ nombre: "", rm: "" });

  // Estados para Dictado Directo y Respaldo de Audio
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [transcribiendoVoz, setTranscribiendoVoz] = useState(false);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);
  const [audioRespaldadoUrl, setAudioRespaldadoUrl] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  const apiBase = window.location.origin.includes(":5173")
    ? "http://192.168.5.21:8000"
    : window.location.origin;

  const cerrarEstacion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isEmbedded && typeof onCerrar === "function") {
      onCerrar();
    } else {
      window.close();
    }
  };

  // Al cambiar el idioma dictado, sincroniza el idioma de salida por defecto (el médico puede cambiarlo luego si desea traducción)
  const handleCambioIdiomaDictado = (nuevoIdioma) => {
    setIdiomaDictado(nuevoIdioma);
    if (nuevoIdioma === "es" || nuevoIdioma === "en") {
      setIdiomaReporte(nuevoIdioma);
    }
  };

  useEffect(() => {
    let usuarioObj =
      user && (user.nombre || user.primer_nombre || user.email || user.username)
        ? user
        : null;

    if (!usuarioObj) {
      const usuarioGuardado = localStorage.getItem("user") || localStorage.getItem("usuario");
      if (usuarioGuardado) {
        try {
          usuarioObj = JSON.parse(usuarioGuardado);
        } catch (error) {
          console.warn("No se pudo analizar el objeto:", error);
        }
      }
    }

    let tokenNombre = "";
    const tokenRaw = (localStorage.getItem("token") || localStorage.getItem("access_token") || "").replace(/['"]+/g, "");
    if (tokenRaw && tokenRaw.includes(".")) {
      try {
        const payload = JSON.parse(atob(tokenRaw.split(".")[1]));
        const posibleSub = String(payload.nombre || payload.name || payload.username || payload.sub || "").trim();
        // Evitar usar el ID numérico del usuario (ej. "4") como nombre del médico
        if (posibleSub && !/^\d+$/.test(posibleSub)) {
          tokenNombre = posibleSub;
        }
        if (!usuarioObj) usuarioObj = payload;
      } catch (e) {}
    }

    const nombreConstruido = usuarioObj
      ? `${usuarioObj.primer_nombre || ""} ${usuarioObj.primer_apellido || ""}`.trim() ||
        usuarioObj.nombre ||
        usuarioObj.nombre_completo ||
        usuarioObj.full_name ||
        (usuarioObj.username && !/^\d+$/.test(String(usuarioObj.username)) ? usuarioObj.username : "") ||
        tokenNombre ||
        ""
      : tokenNombre;

    const rmFinal = usuarioObj
      ? usuarioObj.registro_medico ||
        usuarioObj.rm ||
        usuarioObj.registro ||
        usuarioObj.matricula ||
        ""
      : "";

    setDatosMedicoLogueado({ nombre: nombreConstruido, rm: rmFinal });

    if (isAutoDictado) {
      setAprobado(true);
      setNombreMedico(nombreConstruido);
      setRegistroMedico(rmFinal);
      setTimeout(() => textareaRef.current?.focus(), 120);
    }

    if (estudioId) {
      fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/obtener-transcripcion`)
        .then((res) => res.json())
        .then((data) => {
          const textoFinal =
            data.informe ||
            data.informe_texto ||
            data.informe_text ||
            data.texto ||
            data.informe_final ||
            "";
          setReporteTexto(textoFinal);
        })
        .catch((err) => console.error("Error en fetch de transcripción:", err));
    }

    const tokenSesion = (localStorage.getItem("token") || localStorage.getItem("access_token") || "").replace(/['"]+/g, "");
    if (tokenSesion) {
      fetch(`${apiBase}/api/pacientes/perfil-medico-actual`, {
        headers: { Authorization: `Bearer ${tokenSesion}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((perfil) => {
          if (!perfil) return;
          const nom = perfil.nombre_medico || nombreConstruido;
          const rm = perfil.registro_medico || rmFinal;
          setDatosMedicoLogueado({ nombre: nom, rm: rm });
          if (isAutoDictado) {
            setNombreMedico(nom);
            setRegistroMedico(rm);
          }
        })
        .catch(() => {});
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [estudioId, apiBase, isAutoDictado, user]);

  const iniciarGrabacionDirecta = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeReal = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeReal });
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioRespaldadoUrl(localUrl);
        await procesarAudioDirecto(audioBlob);
      };

      mediaRecorder.start();
      setGrabandoVoz(true);
      setSegundosGrabacion(0);
      timerRef.current = setInterval(() => {
        setSegundosGrabacion((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      alert(
        isEn
          ? "❌ Could not access microphone. Check browser permissions."
          : "❌ No se pudo acceder al micrófono. Verifique los permisos del navegador."
      );
    }
  };

  const detenerYTranscribirDirecto = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setGrabandoVoz(false);
  };

  const procesarAudioDirecto = async (audioBlob) => {
    setTranscribiendoVoz(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

      const formData = new FormData();
      formData.append("audio", audioBlob, `dictado_${estudioId}.wav`);

      const params = new URLSearchParams({
        idioma_dictado: idiomaDictado,
        idioma_reporte: idiomaReporte,
      });

      const response = await fetch(
        `${apiBase}/api/pacientes/estudio/${estudioId}/dictado-directo-ia?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: tokenSesion ? `Bearer ${tokenSesion}` : "",
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Fallo en transcripción automática");
      }

      const data = await response.json();
      setReporteTexto((prev) => (prev.trim() ? `${prev.trim()}\n\n${data.texto}` : data.texto));

      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();
    } catch (error) {
      alert(
        isEn
          ? `❌ Auto-transcription error: ${error.message}`
          : `❌ Error al auto-transcribir: ${error.message}`
      );
    } finally {
      setTranscribiendoVoz(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 60);
    }
  };

  const formatearTiempo = (seg) => {
    const min = String(Math.floor(seg / 60)).padStart(2, "0");
    const s = String(seg % 60).padStart(2, "0");
    return `${min}:${s}`;
  };

  const handleSeleccionAprobacion = (decision) => {
    setAprobado(decision);
    if (decision === true) {
      setNombreMedico(datosMedicoLogueado.nombre);
      setRegistroMedico(datosMedicoLogueado.rm);
    } else {
      setNombreMedico("");
      setRegistroMedico("");
    }
  };

  // ⌨️ ATAJOS ERGONÓMICOS DE TECLADO (SIN NECESIDAD DE USAR EL RATÓN)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F2" || (e.code === "Space" && e.ctrlKey)) {
        e.preventDefault();
        if (estaGenerandoPdf || transcribiendoVoz) return;
        if (grabandoVoz) {
          detenerYTranscribirDirecto();
        } else {
          iniciarGrabacionDirecta();
        }
        return;
      }

      if (e.code === "KeyI" && e.ctrlKey) {
        e.preventDefault();
        if (!cargandoIA && !estaGenerandoPdf && !grabandoVoz && !transcribiendoVoz) {
          handleConsultarIA();
        }
        return;
      }

      if (e.code === "Enter" && e.ctrlKey) {
        e.preventDefault();
        if (aprobado !== null && !grabandoVoz && !transcribiendoVoz && !estaGenerandoPdf) {
          handleProcesarFirma();
        }
        return;
      }

      if (e.code === "Escape") {
        e.preventDefault();
        cerrarEstacion();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    reporteTexto,
    nombreMedico,
    registroMedico,
    aprobado,
    notaRechazo,
    grabandoVoz,
    transcribiendoVoz,
    estaGenerandoPdf,
    cargandoIA,
    idiomaDictado,
    idiomaReporte,
  ]);

  const handleProcesarFirma = async () => {
    if (aprobado === true && !reporteTexto.trim()) {
      alert(
        isEn
          ? "⚠️ The report text cannot be empty before signing."
          : "⚠️ El texto del informe no puede estar vacío antes de firmar."
      );
      return;
    }
    if (aprobado === false && !notaRechazo.trim()) {
      alert(
        isEn
          ? "⚠️ You must enter a brief explanation note to return the report."
          : "⚠️ Debe ingresar una nota de explicación breve para devolver el informe."
      );
      return;
    }
    setEstaGenerandoPdf(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const notaFirma = isEn
        ? `\n\n[MEDICAL CORRECTION NOTE: ${notaRechazo}]`
        : `\n\n[NOTA DE CORRECCIÓN MÉDICA: ${notaRechazo}]`;

      const response = await fetch(`${apiBase}/api/pacientes/estudio/${estudioId}/firmar-informe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: tokenSesion ? `Bearer ${tokenSesion}` : "",
        },
        body: JSON.stringify({
          informe_final: aprobado ? reporteTexto : reporteTexto + notaFirma,
          medico_firma: nombreMedico,
          registro_medico: registroMedico,
          aprobado: aprobado,
          nota_rechazo: notaRechazo,
        }),
      });

      if (!response.ok) throw new Error("Fallo en backend.");
      const canal = new BroadcastChannel("mipacs_refresco_flujo");
      canal.postMessage("actualizar_tabla");
      canal.close();

      if (isEmbedded) {
        alert(
          isEn
            ? "✅ Report signed and PDF generated. You can now click 'Next' for the next study."
            : "✅ Informe firmado y PDF generado. Ya puede pulsar 'Siguiente' para continuar."
        );
      }
      cerrarEstacion();
    } catch (error) {
      alert(isEn ? "❌ Failed to connect to the API." : "❌ Hubo un fallo al conectar con la API.");
    } finally {
      setEstaGenerandoPdf(false);
    }
  };

  const handleConsultarIA = async () => {
    setCargandoIA(true);
    try {
      const tokenSesion = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

      const response = await fetch(
        `${apiBase}/api/pacientes/estudio/${estudioId}/asistencia-ia?lang=${idiomaReporte}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: tokenSesion ? `Bearer ${tokenSesion}` : "",
          },
          body: JSON.stringify({ texto_actual: reporteTexto }),
        }
      );

      if (!response.ok) throw new Error("Fallo de conexión con la IA");
      const data = await response.json();
      setReporteTexto((prev) => prev + `\n\n${data.sugerencia}`);
    } catch (error) {
      alert(
        isEn
          ? `❌ Error invoking AI: ${error.message}`
          : `❌ Error al invocar la IA: ${error.message}`
      );
    } finally {
      setCargandoIA(false);
    }
  };

  const obtenerColorBorde = () => {
    if (grabandoVoz) return "#ef4444";
    if (aprobado === true) return "#10b981";
    if (aprobado === false) return "#ef4444";
    return "#334155";
  };

  const inputEstilo = {
    flex: 1,
    padding: isEmbedded ? "8px 12px" : "15px",
    borderRadius: "6px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: isEmbedded ? "0.9rem" : "1rem",
    transition: "all 0.3s",
  };

  const selectIdiomaEstilo = {
    backgroundColor: "#1e293b",
    color: "#fbbf24",
    border: "1px solid #475569",
    borderRadius: "6px",
    padding: "6px 10px",
    fontWeight: "bold",
    fontSize: "0.85rem",
    cursor: "pointer",
    outline: "none",
  };

  const kbdEstilo = {
    backgroundColor: "#1e293b",
    color: "#fbbf24",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid #334155",
    fontWeight: "bold",
  };

  const esTraduccion = idiomaDictado !== "auto" && idiomaDictado !== idiomaReporte;

  return (
    <div
      style={{
        width: isEmbedded ? "100%" : "100vw",
        height: isEmbedded ? "100%" : "100vh",
        background: "#07080a",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        padding: isEmbedded ? "12px 20px" : "30px",
        border: isEmbedded ? "none" : `8px solid ${obtenerColorBorde()}`,
        transition: "all 0.3s ease",
        overflowY: "auto",
      }}
    >
      {/* CABECERA + SELECTORES DE IDIOMA + DICTADO + IA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isEmbedded ? "10px" : "15px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h2
            style={{
              color: "#fff",
              margin: 0,
              fontSize: isEmbedded ? "1.1rem" : "1.6rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isAutoDictado ? "⚡" : "🔏"}{" "}
            {isEn ? "Direct Dictation & Signature" : "Dictado Directo y Firma Digital"}
          </h2>

          {/* SELECTOR DE IDIOMA DE VOZ Y DE REPORTE */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              padding: "4px 10px",
              borderRadius: "8px",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "bold" }}>
              {isEn ? "Spoken:" : "Dictado:"}
            </span>
            <select
              value={idiomaDictado}
              onChange={(e) => handleCambioIdiomaDictado(e.target.value)}
              disabled={grabandoVoz || transcribiendoVoz}
              style={selectIdiomaEstilo}
              title={isEn ? "Language you are speaking" : "Idioma en el que vas a hablar"}
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇺🇸 English</option>
              <option value="auto">🌐 Auto</option>
            </select>

            <span style={{ color: "#38bdf8", fontWeight: "bold" }}>➔</span>

            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "bold" }}>
              {isEn ? "Report:" : "Reporte:"}
            </span>
            <select
              value={idiomaReporte}
              onChange={(e) => setIdiomaReporte(e.target.value)}
              disabled={grabandoVoz || transcribiendoVoz}
              style={selectIdiomaEstilo}
              title={isEn ? "Language of the written report" : "Idioma en que se escribirá el informe"}
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇺🇸 English</option>
            </select>

            {esTraduccion && (
              <span
                style={{
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                }}
              >
                {isEn ? "Medical Translation Active" : "Traducción Médica Activa"}
              </span>
            )}
          </div>

          {!grabandoVoz ? (
            <button
              onClick={iniciarGrabacionDirecta}
              disabled={transcribiendoVoz || estaGenerandoPdf}
              title={isEn ? "Shortcut: F2 or Ctrl + Space" : "Atajo: F2 o Ctrl + Espacio"}
              style={{
                padding: isEmbedded ? "7px 14px" : "10px 18px",
                backgroundColor: "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: transcribiendoVoz ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
              }}
            >
              {transcribiendoVoz
                ? isEn
                  ? "⏳ Processing Audio..."
                  : "⏳ Procesando Audio..."
                : reporteTexto.trim()
                ? isEn
                  ? "🎙️ Resume (F2)"
                  : "🎙️ Reanudar (F2)"
                : isEn
                ? "🎙️ Dictate (F2)"
                : "🎙️ Dictar (F2)"}
            </button>
          ) : (
            <button
              onClick={detenerYTranscribirDirecto}
              title={isEn ? "Shortcut: F2 or Ctrl + Space" : "Atajo: F2 o Ctrl + Espacio"}
              style={{
                padding: isEmbedded ? "7px 14px" : "10px 18px",
                backgroundColor: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
              }}
            >
              ⏹️{" "}
              {isEn
                ? `Stop (${formatearTiempo(segundosGrabacion)}) [F2]`
                : `Detener (${formatearTiempo(segundosGrabacion)}) [F2]`}
            </button>
          )}

          {audioRespaldadoUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "0.8rem" }}>
                🔒 {isEn ? "Backed Up" : "Respaldado"}
              </span>
              <audio controls src={audioRespaldadoUrl} style={{ height: "28px" }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>
            <kbd style={kbdEstilo}>F2</kbd> / <kbd style={kbdEstilo}>Ctrl+Space</kbd>{" "}
            {isEn ? "Dictate" : "Dictar"} ·{" "}
            <kbd style={kbdEstilo}>Ctrl+I</kbd> IA ·{" "}
            <kbd style={kbdEstilo}>Ctrl+Enter</kbd> {isEn ? "Sign" : "Firmar"} ·{" "}
            <kbd style={kbdEstilo}>Esc</kbd> {isEn ? "Close" : "Cerrar"}
          </span>

          <button
            onClick={handleConsultarIA}
            disabled={cargandoIA || estaGenerandoPdf || grabandoVoz || transcribiendoVoz}
            style={{
              padding: isEmbedded ? "7px 14px" : "10px 20px",
              backgroundColor: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: cargandoIA ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {cargandoIA
              ? isEn
                ? "⏳ Processing..."
                : "⏳ Procesando..."
              : isEn
              ? "🤖 AI Assist"
              : "🤖 Asistencia IA"}
          </button>
        </div>
      </div>

      {/* ÁREA DE TEXTO CLÍNICO */}
      <textarea
        ref={textareaRef}
        value={reporteTexto}
        onChange={(e) => setReporteTexto(e.target.value)}
        placeholder={
          idiomaReporte === "en"
            ? "Press F2 (or Ctrl+Space) to dictate/resume, or type your clinical findings in English..."
            : "Presione F2 (o Ctrl+Espacio) para dictar/reanudar, o escriba aquí sus hallazgos clínicos en Español..."
        }
        style={{
          flex: 1,
          padding: isEmbedded ? "14px 18px" : "25px",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          border: `2px solid ${obtenerColorBorde()}`,
          borderRadius: "8px",
          fontSize: isEmbedded ? "15px" : "16px",
          lineHeight: "1.6",
          resize: "none",
          marginBottom: isEmbedded ? "10px" : "18px",
          overflowY: "auto",
          minHeight: isEmbedded ? "115px" : "230px",
        }}
      />

      {/* CONFIRMACIÓN Y CREDENCIALES DEL RADIÓLOGO EN UNA FILA COMPACTA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
          flexWrap: "wrap",
          backgroundColor: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "8px",
          padding: isEmbedded ? "10px 15px" : "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
          <label
            style={{
              color: "#10b981",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: isEmbedded ? "0.9rem" : "1rem",
            }}
          >
            <input
              type="radio"
              checked={aprobado === true}
              onChange={() => handleSeleccionAprobacion(true)}
              style={{ width: "17px", height: "17px", accentColor: "#10b981" }}
            />
            {isEn ? "Validate & Sign" : "Validar y Firmar"}
          </label>

          {!isAutoDictado && (
            <label
              style={{
                color: "#ef4444",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                checked={aprobado === false}
                onChange={() => handleSeleccionAprobacion(false)}
                style={{ width: "17px", height: "17px", accentColor: "#ef4444" }}
              />
              {isEn ? "Reject & Return" : "Devolver con observaciones"}
            </label>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={nombreMedico}
              onChange={(e) => setNombreMedico(e.target.value)}
              placeholder={isEn ? "Radiologist Name" : "Nombre del Radiólogo"}
              style={{ ...inputEstilo, minWidth: "200px" }}
              disabled={aprobado !== true}
            />
            <input
              type="text"
              value={registroMedico}
              onChange={(e) => setRegistroMedico(e.target.value)}
              placeholder={isEn ? "Medical Reg. (MR)" : "Registro Médico (RM)"}
              style={{ ...inputEstilo, maxWidth: "160px" }}
              disabled={aprobado !== true}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={cerrarEstacion}
            disabled={estaGenerandoPdf}
            style={{
              padding: isEmbedded ? "9px 16px" : "12px 25px",
              background: "#334155",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isEn ? "Close" : "Cerrar"}
          </button>

          <button
            onClick={handleProcesarFirma}
            disabled={
              estaGenerandoPdf ||
              aprobado === null ||
              grabandoVoz ||
              transcribiendoVoz ||
              (aprobado === false && !notaRechazo.trim())
            }
            style={{
              padding: isEmbedded ? "9px 22px" : "12px 35px",
              backgroundColor: aprobado === null ? "#4b5563" : aprobado ? "#10b981" : "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: isEmbedded ? "0.98rem" : "1.1rem",
              cursor: estaGenerandoPdf || aprobado === null ? "not-allowed" : "pointer",
              boxShadow:
                aprobado === null
                  ? "none"
                  : `0 4px 15px ${aprobado ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            }}
          >
            {estaGenerandoPdf
              ? isEn
                ? "⏳ Signing..."
                : "⏳ Firmando..."
              : aprobado === false
              ? isEn
                ? "❌ Return Report"
                : "❌ Devolver Informe"
              : isEn
              ? "🔏 Confirm and Sign Document"
              : "🔏 Confirmar y Firmar Documento"}
          </button>
        </div>

        {aprobado === false && (
          <div style={{ width: "100%", marginTop: "10px" }}>
            <textarea
              value={notaRechazo}
              onChange={(e) => setNotaRechazo(e.target.value)}
              placeholder={
                isEn
                  ? "Detail what corrections or additions are needed..."
                  : "Indique detalladamente qué correcciones o agregados se necesitan..."
              }
              style={{
                width: "100%",
                height: "65px",
                padding: "8px",
                backgroundColor: "#1f2937",
                color: "white",
                border: "1px solid #ef4444",
                borderRadius: "6px",
                resize: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}