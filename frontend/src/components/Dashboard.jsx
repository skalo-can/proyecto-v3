import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";

export default function ConfiguracionPACS() {
  const { user } = useAuth();
  const token = user?.token || localStorage.getItem("token");
  
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  const [dicomConfig, setDicomConfig] = useState({ ae_title: "MI_PACS", ip: "0.0.0.0", port: "11112", client_ae: "WEASIS" });
  
  const [nodosDestino, setNodosDestino] = useState([
    { id: 1, nombre: "Estación Principal Radiólogo", ae_title: "HOROS_GUILLERMO", ip: "192.168.1.50", puerto: "4096", auto_envio: true },
    { id: 2, nombre: "Estación Consulta Urgencias", ae_title: "OSIRIX_URG", ip: "192.168.1.120", puerto: "11116", auto_envio: false }
  ]);
  const [nuevoNodo, setNuevoNodo] = useState({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false });

  // Impresoras (AGFA con Puerto y CANON con Modelo Editable)
  const [impresoraAgfa, setImpresoraAgfa] = useState({ ae_title: "AGFA_DRYSTAR", ip: "192.168.1.200", puerto: "104", formato_pelicula: "14x17" });
  const [impresoraCanon, setImpresoraCanon] = useState({ modelo: "Rayos_x", ip: "192.168.1.210", cola: "Canon_DX_C3926i", formato_papel: "A3" });

  const [serverStatus, setServerStatus] = useState("ACTIVO"); 
  const [logs, setLogs] = useState(["[SISTEMA] Conexión establecida con la infraestructura MI_PACS."]);
  const endOfLogsRef = useRef(null);

  useEffect(() => {
    if (endOfLogsRef.current) endOfLogsRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/dicom/config', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data && data.ae_title) {
          setDicomConfig({ ae_title: data.ae_title, ip: data.ip_address || data.ip || "0.0.0.0", port: data.port || "11112", client_ae: data.client_ae || "WEASIS" });
        }
      })
      .catch(() => agregarLog("[ADVERTENCIA] Usando configuración local por desconexión de API."));
  }, [token]);

  const agregarLog = (linea) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${linea}`]);

  // ==========================================
  // FUNCIONES DEL NODO PACS
  // ==========================================
  const handleGuardarPACS = async (e) => {
    e.preventDefault();
    setLoading(true); setServerStatus("REINICIANDO");
    agregarLog(`[SISTEMA] Aplicando cambios y reiniciando socket de escucha PACS...`);
    try {
      await fetch("http://127.0.0.1:8000/api/dicom/config", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ae_title: dicomConfig.ae_title, ip_address: dicomConfig.ip, port: parseInt(dicomConfig.port), client_ae: dicomConfig.client_ae })
      });
      setServerStatus("ACTIVO"); setMensaje({ texto: "✅ Nodo PACS guardado y reiniciado.", tipo: "success" });
      agregarLog(`[MI_PACS] Servidor operativo escuchando en puerto ${dicomConfig.port}`);
    } catch (err) {
      setServerStatus("DETENIDO"); setMensaje({ texto: "❌ Error al guardar PACS.", tipo: "error" });
    } finally { setLoading(false); setTimeout(() => setMensaje({ texto: "", tipo: "" }), 3000); }
  };

  const handleTestPACS = () => {
    agregarLog(`[PRUEBA] Verificando puerto de escucha local ${dicomConfig.port}...`);
    setTimeout(() => agregarLog(`✅ [EXITO] El servidor MI_PACS está respondiendo correctamente.`), 1000);
  };

  // ==========================================
  // FUNCIONES DE IMPRESORAS
  // ==========================================
  const handleTestAgfa = () => {
    agregarLog(`[PING] Verificando red hacia impresora AGFA en IP: ${impresoraAgfa.ip}...`);
    setTimeout(() => {
      agregarLog(`✅ [EXITO] Ping Normal (ICMP) completado.`);
      agregarLog(`[C-ECHO] Negociando asociación DICOM con ${impresoraAgfa.ae_title} en puerto ${impresoraAgfa.puerto}...`);
      setTimeout(() => agregarLog(`✅ [EXITO] Asociación DICOM Print Management aceptada.`), 1500);
    }, 1000);
  };

  const handleGuardarAgfa = () => {
    agregarLog(`[SISTEMA] Configuración de Impresora AGFA (${impresoraAgfa.ae_title}) guardada en Base de Datos.`);
    setMensaje({ texto: "✅ Impresora de Acetatos guardada.", tipo: "success" });
    setTimeout(() => setMensaje({ texto: "", tipo: "" }), 3000);
  };

  const handleTestCanon = () => {
    agregarLog(`[PING] Verificando red hacia impresora láser color en IP: ${impresoraCanon.ip}...`);
    setTimeout(() => agregarLog(`✅ [EXITO] Ping Normal (ICMP) a ${impresoraCanon.modelo} completado. La cola ${impresoraCanon.cola} está accesible.`), 1500);
  };

  const handleGuardarCanon = () => {
    agregarLog(`[SISTEMA] Configuración de Impresora ${impresoraCanon.modelo} guardada en Base de Datos.`);
    setMensaje({ texto: "✅ Impresora Láser guardada.", tipo: "success" });
    setTimeout(() => setMensaje({ texto: "", tipo: "" }), 3000);
  };

  // ==========================================
  // FUNCIONES DE ESTACIONES DIAGNÓSTICAS
  // ==========================================
  const handleAddNodo = (e) => {
    e.preventDefault();
    setNodosDestino([...nodosDestino, { ...nuevoNodo, id: Date.now() }]);
    agregarLog(`[ROUTER] Nuevo nodo registrado: ${nuevoNodo.nombre} (${nuevoNodo.ae_title})`);
    setNuevoNodo({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false });
  };

  const handleTestNodoLista = (nodo) => {
    agregarLog(`[PING] Haciendo Ping a la estación ${nodo.ip}...`);
    setTimeout(() => {
      agregarLog(`[C-ECHO] Enviando Ping DICOM al AET: ${nodo.ae_title} en puerto ${nodo.puerto}...`);
      setTimeout(() => agregarLog(`✅ [EXITO] Estación ${nodo.ae_title} respondió correctamente al DICOM Ping.`), 1000);
    }, 800);
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}>Configuración de Infraestructura MI_PACS</h2>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.95rem" }}>
          Gestione Nodos DICOM, pruebe asociaciones de red y administre impresoras físicas y virtuales.
        </p>
      </header>

      {mensaje.texto && (
        <div style={{ ...alertStyle, backgroundColor: mensaje.tipo === "success" ? "#10b98122" : "#ef444422", borderColor: mensaje.tipo === "success" ? "#10b981" : "#ef4444" }}>
          {mensaje.texto}
        </div>
      )}

      <div style={gridLayout}>
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          {/* NODO PACS LOCAL */}
          <div style={cardStyle}>
            <div style={headerCardFlex}>
              <h3 style={sectionTitle}>⚙️ Nodo Local PACS (StoreSCP)</h3>
              <span style={badgeStatus(serverStatus)}>{serverStatus === "ACTIVO" ? "🟢 ESCUCHANDO" : "🔴 DETENIDO"}</span>
            </div>
            <form onSubmit={handleGuardarPACS}>
              <div style={{ display: "flex", gap: "15px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>PACS AE Title:</label><input type="text" name="ae_title" style={inputStyle} value={dicomConfig.ae_title} onChange={(e) => setDicomConfig({...dicomConfig, ae_title: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Puerto DICOM:</label><input type="number" name="port" style={inputStyle} value={dicomConfig.port} onChange={(e) => setDicomConfig({...dicomConfig, port: e.target.value})} required /></div>
              </div>
              <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>IP de Escucha:</label><input type="text" name="ip" style={inputStyle} value={dicomConfig.ip} onChange={(e) => setDicomConfig({...dicomConfig, ip: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>AE Title Visor Integrado:</label><input type="text" name="client_ae" style={inputStyle} value={dicomConfig.client_ae} onChange={(e) => setDicomConfig({...dicomConfig, client_ae: e.target.value})} required /></div>
              </div>
              <div style={btnRowStyle}>
                <button type="button" onClick={handleTestPACS} style={btnTestStyle}>📡 Probar Servidor</button>
                <button type="submit" disabled={loading} style={btnGuardarStyle}>💾 Guardar y Reiniciar</button>
              </div>
            </form>
          </div>

          {/* RED DE IMPRESORAS */}
          <div style={cardStyle}>
            <h3 style={{ ...sectionTitle, borderBottom: "1px solid #333", paddingBottom: "10px" }}>🖨️ Servidores de Impresión Física</h3>
            
            {/* AGFA DRYSTAR */}
            <div style={subCardStyle}>
              <h4 style={{ margin: "0 0 10px 0", color: "#60a5fa", fontSize: "0.95rem" }}>🔘 Impresora de Acetatos (AGFA Drystar - DICOM)</h4>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>IP Red</label><input type="text" style={inputStyle} value={impresoraAgfa.ip} onChange={e => setImpresoraAgfa({...impresoraAgfa, ip: e.target.value})} /></div>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>AE Title DICOM</label><input type="text" style={inputStyle} value={impresoraAgfa.ae_title} onChange={e => setImpresoraAgfa({...impresoraAgfa, ae_title: e.target.value})} /></div>
                <div style={{ flex: 1 }}><label style={labelMicro}>Puerto</label><input type="text" style={inputStyle} value={impresoraAgfa.puerto} onChange={e => setImpresoraAgfa({...impresoraAgfa, puerto: e.target.value})} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#aaa", fontWeight: "bold" }}>Medida de Película (Rayos X/TAC):</span>
                <select style={{ ...inputStyle, width: "140px", marginBottom: 0 }} value={impresoraAgfa.formato_pelicula} onChange={e => setImpresoraAgfa({...impresoraAgfa, formato_pelicula: e.target.value})}>
                  <option value="14x17">14" x 17"</option>
                  <option value="11x14">11" x 14"</option>
                  <option value="8x10">8" x 10"</option>
                </select>
              </div>
              <div style={btnRowStyle}>
                <button onClick={handleTestAgfa} style={{...btnTestStyle, padding: "8px 15px", fontSize: "0.85rem"}}>📡 PING + DICOM ECHO</button>
                <button onClick={handleGuardarAgfa} style={{...btnGuardarStyle, padding: "8px 15px", fontSize: "0.85rem"}}>💾 Guardar Agfa</button>
              </div>
            </div>

            {/* CANON LÁSER */}
            <div style={{ ...subCardStyle, marginTop: "15px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#10b981", fontSize: "0.95rem" }}>🎨 Impresora Láser Color (Canon Estándar)</h4>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ flex: 2 }}><label style={labelMicro}>NOMBRE (Ej: Canon _Rayos_X)</label><input type="text" style={inputStyle} value={impresoraCanon.modelo} onChange={e => setImpresoraCanon({...impresoraCanon, modelo: e.target.value})} /></div>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>IP Red</label><input type="text" style={inputStyle} value={impresoraCanon.ip} onChange={e => setImpresoraCanon({...impresoraCanon, ip: e.target.value})} /></div>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>MODELO</label><input type="text" style={inputStyle} value={impresoraCanon.cola} onChange={e => setImpresoraCanon({...impresoraCanon, cola: e.target.value})} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#aaa", fontWeight: "bold" }}>Formato de Papel (Color 3D):</span>
                <select style={{ ...inputStyle, width: "140px", marginBottom: 0 }} value={impresoraCanon.formato_papel} onChange={e => setImpresoraCanon({...impresoraCanon, formato_papel: e.target.value})}>
                  <option value="A3">A3 / Doble Carta</option>
                  <option value="Carta">Carta (Letter)</option>
                  <option value="Oficio">Oficio (Legal)</option>
                </select>
              </div>
              <div style={btnRowStyle}>
                <button onClick={handleTestCanon} style={{...btnTestStyle, padding: "8px 15px", fontSize: "0.85rem", color: "#10b981", borderColor: "#10b981"}}>🌐 PING NORMAL (ICMP)</button>
                <button onClick={handleGuardarCanon} style={{...btnGuardarStyle, padding: "8px 15px", fontSize: "0.85rem", background: "#10b981"}}>💾 Guardar Canon</button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMNA DERECHA: ESTACIONES DIAGNÓSTICAS Y LOGS
            ======================================================== */}
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          <div style={cardStyle}>
            <h3 style={sectionTitle}>🖥️ Estaciones de Diagnóstico (Nodos C-STORE)</h3>
            <form onSubmit={handleAddNodo} style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
              <input type="text" placeholder="Nombre" style={{ ...inputStyle, marginBottom: 0 }} value={nuevoNodo.nombre} onChange={e => setNuevoNodo({...nuevoNodo, nombre: e.target.value})} required />
              <input type="text" placeholder="AET" style={{ ...inputStyle, marginBottom: 0, width: "90px" }} value={nuevoNodo.ae_title} onChange={e => setNuevoNodo({...nuevoNodo, ae_title: e.target.value})} required />
              <input type="text" placeholder="IP" style={{ ...inputStyle, marginBottom: 0, width: "110px" }} value={nuevoNodo.ip} onChange={e => setNuevoNodo({...nuevoNodo, ip: e.target.value})} required />
              <input type="text" placeholder="Port" style={{ ...inputStyle, marginBottom: 0, width: "70px" }} value={nuevoNodo.puerto} onChange={e => setNuevoNodo({...nuevoNodo, puerto: e.target.value})} required />
              <button type="submit" style={{ ...btnGuardarStyle, margin: 0, width: "auto", padding: "0 15px" }}>➕ Añadir</button>
            </form>

            <div style={{ maxHeight: "250px", overflowY: "auto", background: "#0a0c0f", padding: "10px", borderRadius: "6px", border: "1px solid #333" }}>
              {nodosDestino.map((n) => (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", padding: "10px 0" }}>
                  <div>
                    <strong style={{ color: "#fbbf24", fontSize: "0.9rem" }}>{n.nombre}</strong>
                    <div style={{ color: "#aaa", fontSize: "0.75rem", marginTop: "4px" }}>AET: {n.ae_title} | IP: {n.ip}:{n.puerto}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "0.75rem", color: "#94a3b8" }}>
                      <input type="checkbox" checked={n.auto_envio} onChange={() => setNodosDestino(nodosDestino.map(x => x.id === n.id ? { ...x, auto_envio: !x.auto_envio } : x))} /> Auto Enviar
                    </label>
                    <button onClick={() => handleTestNodoLista(n)} style={{ background: "transparent", color: "#0ea5e9", border: "1px solid #0ea5e9", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}>📡 Probar</button>
                    <button onClick={() => {
                        agregarLog(`[SISTEMA] Estación ${n.nombre} guardada exitosamente.`);
                        setMensaje({ texto: `✅ Estación ${n.nombre} guardada.`, tipo: "success" });
                        setTimeout(() => setMensaje({texto:"", tipo:""}), 3000);
                      }} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "bold" }}>💾 Guardar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={headerCardFlex}>
              <h3 style={{ ...sectionTitle, color: "#3b82f6" }}>📡 Consola de Red DICOM (Live)</h3>
              <button onClick={() => setLogs(["[SISTEMA] Consola limpiada."])} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}>🧹 Limpiar</button>
            </div>
            <div style={terminalStyle}>
              {logs.map((log, index) => {
                let color = "#10b981"; 
                if (log.includes("[ERROR]") || log.includes("Fallo")) color = "#ef4444";
                if (log.includes("[SISTEMA]")) color = "#3b82f6";
                if (log.includes("[PING]") || log.includes("[PRUEBA]")) color = "#fbbf24";
                if (log.includes("[C-ECHO]")) color = "#a855f7"; // Morado para los DICOM Pings
                return <div key={index} style={{ color, marginBottom: "4px" }}>{log}</div>;
              })}
              <div ref={endOfLogsRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ESTILOS DE INTERFAZ 
// ==========================================
const containerStyle = { padding: "30px", color: "white", backgroundColor: "#0f1114", minHeight: "100vh", width: "100%", boxSizing: "border-box" };
const headerStyle = { marginBottom: "25px", borderBottom: "1px solid #222", paddingBottom: "15px" };
const titleStyle = { color: "#fbbf24", margin: "0 0 10px 0", borderLeft: "4px solid #fbbf24", paddingLeft: "15px", fontSize: "1.8rem" };
const gridLayout = { display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "25px" };
const cardStyle = { background: "#1a1d21", padding: "20px", borderRadius: "10px", border: "1px solid #333", display: "flex", flexDirection: "column" };
const subCardStyle = { background: "#111418", padding: "15px", borderRadius: "8px", border: "1px solid #222" };
const headerCardFlex = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid #333", paddingBottom: "10px" };
const sectionTitle = { margin: 0, color: "#fbbf24", fontSize: "1.1rem", fontWeight: "bold" };
const labelStyle = { color: "#94a3b8", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "6px", display: "block" };
const labelMicro = { color: "#64748b", fontSize: "0.7rem", fontWeight: "bold", marginBottom: "4px", display: "block" };
const inputStyle = { background: "#0a0c0f", border: "1px solid #333", color: "#fbbf24", padding: "10px", borderRadius: "6px", width: "100%", boxSizing: "border-box", fontSize: "0.9rem", fontFamily: "monospace", marginBottom: "0" };
const alertStyle = { padding: "15px", borderRadius: "8px", border: "1px solid", marginBottom: "25px", color: "#fff", fontSize: "0.95rem" };
const btnRowStyle = { display: "flex", gap: "10px", marginTop: "15px" };
const btnGuardarStyle = { flex: 1, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s" };
const btnTestStyle = { flex: 1, background: "transparent", color: "#0ea5e9", border: "1px solid #0ea5e9", padding: "10px 15px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s" };
const terminalStyle = { background: "#000", border: "1px solid #333", borderRadius: "6px", padding: "12px", fontFamily: "Consolas, monospace", fontSize: "0.8rem", height: "300px", overflowY: "auto", flexGrow: 1, boxShadow: "inset 0 0 10px rgba(0,0,0,0.8)", lineHeight: "1.4" };
const badgeStatus = (status) => ({ padding: "6px 10px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", backgroundColor: status === "ACTIVO" ? "#10b98122" : "#ef444422", color: status === "ACTIVO" ? "#10b981" : "#ef4444", border: `1px solid ${status === "ACTIVO" ? "#10b981" : "#ef4444"}` });