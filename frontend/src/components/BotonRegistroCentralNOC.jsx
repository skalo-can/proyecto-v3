import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useTranslation } from "react-i18next";
import "./BotonRegistroCentralNOC.css";

export default function BotonRegistroCentralNOC() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  // Renderizado estricto: solo visible para Super Administrador
  const rolActual = String(user?.rol || "").toLowerCase().trim();
  if (rolActual !== "superadmin") return null;

  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [inventario, setInventario] = useState(null);
  const [uuidActual, setUuidActual] = useState("");
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    cliente_nombre: "",
    ciudad: "",
    pais: "",
    contacto_sitio: "",
    central_noc_url: "",
    regenerar_uuid: false,
  });

  const apiBase = window.location.origin.includes(":5173")
    ? "http://192.168.5.21:8000"
    : window.location.origin;

  const abrirModal = async () => {
    setAbierto(true);
    setResultado(null);
    setErrorMsg("");
    setCargando(true);
    try {
      const token = user?.token || localStorage.getItem("token") || "";
      const res = await fetch(`${apiBase}/api/noc/config-nodo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error leyendo inventario local");

      setUuidActual(data.identidad?.server_uuid || "");
      setInventario(data.inventario_detectado || null);
      setForm({
        cliente_nombre: data.identidad?.cliente_nombre || "",
        ciudad: data.identidad?.ciudad || "",
        pais: data.identidad?.pais || "",
        contacto_sitio: data.identidad?.contacto_sitio || "",
        central_noc_url: data.identidad?.central_noc_url || "",
        regenerar_uuid: false,
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleSincronizar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);
    setErrorMsg("");

    try {
      const token = user?.token || localStorage.getItem("token") || "";
      const res = await fetch(`${apiBase}/api/noc/registrar-inventario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo registrar el servidor");

      setUuidActual(data.server_uuid || uuidActual);
      setInventario(data.inventario_enviado || inventario);
      setForm((prev) => ({ ...prev, regenerar_uuid: false }));
      setResultado(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="noc-reg-trigger-btn"
        onClick={abrirModal}
        title={
          isEn
            ? "Auto-register this server and sync hardware/DICOM inventory with MI_PACS Central"
            : "Auto-registrar este servidor y enviar inventario completo a MI_PACS Central"
        }
      >
        <span>🛰️</span>
        <span>{isEn ? "NOC Global Registry" : "Registro Central NOC"}</span>
      </button>

      {abierto && (
        <div className="noc-reg-backdrop" onClick={() => setAbierto(false)}>
          <div className="noc-reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="noc-reg-header">
              <h3>
                🛰️{" "}
                {isEn
                  ? "MI_PACS Central — Server Auto-Registration & Inventory"
                  : "MI_PACS Central — Auto-Registro e Inventario del Servidor"}
              </h3>
              <button
                type="button"
                className="noc-reg-close"
                onClick={() => setAbierto(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSincronizar} className="noc-reg-body">
              {cargando ? (
                <div style={{ color: "#fbbf24", fontSize: "13px" }}>
                  {isEn
                    ? "Scanning server hardware, NAS, DICOM, and database..."
                    : "Escaneando hardware, NAS, motor DICOM y base de datos..."}
                </div>
              ) : (
                <>
                  <div className="noc-reg-grid-form">
                    <div className="noc-reg-field full">
                      <label>
                        {isEn
                          ? "Hospital / Clinic Name"
                          : "Nombre de la Institución / Clínica"}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.cliente_nombre}
                        onChange={(e) =>
                          setForm({ ...form, cliente_nombre: e.target.value })
                        }
                        placeholder="Ej: Clínica Santa María — Sede Norte"
                      />
                    </div>

                    <div className="noc-reg-field">
                      <label>
                        {isEn
                          ? "City (leave blank for IP auto-detect)"
                          : "Ciudad (vacío = autodetección por IP)"}
                      </label>
                      <input
                        type="text"
                        value={form.ciudad}
                        onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                        placeholder="Auto"
                      />
                    </div>

                    <div className="noc-reg-field">
                      <label>
                        {isEn
                          ? "Country (leave blank for IP auto-detect)"
                          : "País (vacío = autodetección por IP)"}
                      </label>
                      <input
                        type="text"
                        value={form.pais}
                        onChange={(e) => setForm({ ...form, pais: e.target.value })}
                        placeholder="Auto"
                      />
                    </div>

                    <div className="noc-reg-field">
                      <label>
                        {isEn ? "On-Site IT / Admin Contact" : "Contacto Técnico / Admin en Sitio"}
                      </label>
                      <input
                        type="text"
                        value={form.contacto_sitio}
                        onChange={(e) =>
                          setForm({ ...form, contacto_sitio: e.target.value })
                        }
                        placeholder="Nombre / Teléfono / Email"
                      />
                    </div>

                    <div className="noc-reg-field">
                      <label>
                        {isEn ? "Central NOC Endpoint URL" : "URL de Central de Monitoreo NOC"}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.central_noc_url}
                        onChange={(e) =>
                          setForm({ ...form, central_noc_url: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {inventario && (
                    <div className="noc-reg-inv-box">
                      <div className="noc-reg-inv-title">
                        📋{" "}
                        {isEn
                          ? `Detected Server Inventory (UUID: ${uuidActual})`
                          : `Inventario Detectado Automáticamente (UUID: ${uuidActual})`}
                      </div>
                      <div className="noc-reg-inv-list">
                        <span>
                          Hostname: <b>{inventario.hostname}</b>
                        </span>
                        <span>
                          OS: <b>{inventario.so_info}</b>
                        </span>
                        <span>
                          CPU: <b>{inventario.nucleos_cpu} cores ({inventario.cpu_pct}%)</b>
                        </span>
                        <span>
                          RAM: <b>{inventario.ram_total_gb} GB ({inventario.ram_pct}%)</b>
                        </span>
                        <span>
                          NAS: <b>{inventario.disco_nas_libre_gb} / {inventario.disco_nas_total_gb} GB</b>
                        </span>
                        <span>
                          DICOM: <b>{inventario.ae_title_dicom} :{inventario.puerto_dicom} ({inventario.dicom_activo ? "ONLINE" : "DOWN"})</b>
                        </span>
                        <span>
                          Estudios Históricos: <b>{inventario.total_estudios_historico}</b>
                        </span>
                        <span>
                          Pacientes Históricos: <b>{inventario.total_pacientes_historico}</b>
                        </span>
                      </div>
                    </div>
                  )}

                  <label className="noc-reg-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.regenerar_uuid}
                      onChange={(e) =>
                        setForm({ ...form, regenerar_uuid: e.target.checked })
                      }
                    />
                    <span>
                      {isEn
                        ? "Generate a brand-new Server UUID (use if this server was cloned from another clinic)"
                        : "Generar nuevo UUID único de servidor (marcar si este servidor fue clonado de otra clínica)"}
                    </span>
                  </label>

                  {resultado && (
                    <div className="noc-reg-alert-ok">
                      ✅ {resultado.mensaje} — UUID: <b>{resultado.server_uuid}</b> (
                      {resultado.geo_asignada?.ciudad}, {resultado.geo_asignada?.pais})
                    </div>
                  )}

                  {errorMsg && <div className="noc-reg-alert-err">⚠️ {errorMsg}</div>}

                  <div className="noc-reg-footer" style={{ padding: "10px 0 0", borderTop: "none", background: "transparent" }}>
                    <button
                      type="button"
                      className="noc-reg-btn-cancel"
                      onClick={() => setAbierto(false)}
                    >
                      {isEn ? "Close" : "Cerrar"}
                    </button>
                    <button
                      type="submit"
                      className="noc-reg-btn-submit"
                      disabled={enviando}
                    >
                      {enviando
                        ? isEn
                          ? "Syncing with Central..."
                          : "Sincronizando con Central..."
                        : isEn
                          ? "🛰️ Register & Sync Inventory"
                          : "🛰️ Registrar e Inventariar Ahora"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}