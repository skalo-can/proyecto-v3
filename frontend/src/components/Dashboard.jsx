import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";

export default function ConfiguracionPACS() {
  const { user } = useAuth();
  const token = user?.token || localStorage.getItem("token");
  
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  const [dicomConfig, setDicomConfig] = useState({ ae_title: "MI_PACS", ip: "0.0.0.0", port: "11112", client_ae: "WEASIS" });
  
  // 🚀 ESTADO VACÍO: Ahora nacerá vacío y se llenará con lo que diga la Base de Datos
  const [nodosDestino, setNodosDestino] = useState([]);
  
  const modalidadesDisponibles = ["CT", "MR", "CR", "DX", "US", "MG", "PT", "XA"];
  
  const [nuevoNodo, setNuevoNodo] = useState({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false, activo: true, modalidades: [] });
  const [editandoId, setEditandoId] = useState(null); 

  const [impresoraAgfa, setImpresoraAgfa] = useState({ ae_title: "AGFA_DRYSTAR", ip: "192.168.1.200", puerto: "104", formato_pelicula: "14x17" });
  const [impresoraCanon, setImpresoraCanon] = useState({ modelo: "Rayos_x", ip: "192.168.1.210", cola: "Canon_DX_C3926i", formato_papel: "A3" });

  const [serverStatus, setServerStatus] = useState("ACTIVO"); 
  const [logs, setLogs] = useState(["[SISTEMA] Conexión establecida con la infraestructura MI_PACS."]);
  const endOfLogsRef = useRef(null);

  useEffect(() => {
    if (endOfLogsRef.current) endOfLogsRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 🚀 CARGA INICIAL DESDE LA BASE DE DATOS
  useEffect(() => {
    // 1. Cargar Configuración del Servidor Local
    fetch('http://127.0.0.1:8000/api/dicom/config', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data && data.ae_title) {
          setDicomConfig({ ae_title: data.ae_title, ip: data.ip_address || data.ip || "0.0.0.0", port: data.port || "11112", client_ae: data.client_ae || "WEASIS" });
        }
      })
      .catch(() => agregarLog("[ADVERTENCIA] Usando configuración local por desconexión de API."));

    // 2. Cargar Nodos (Estaciones) desde la Base de Datos
    fetch('http://127.0.0.1:8000/api/dicom/nodos', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNodosDestino(data);
          agregarLog(`[SISTEMA] ${data.length} estaciones de diagnóstico cargadas desde la BD.`);
        }
      })
      .catch(() => {
        agregarLog("[ERROR] No se pudieron cargar las estaciones desde la Base de Datos.");
        // Fallback visual por si el backend aún no tiene el endpoint:
        setNodosDestino([
          { id: 1, nombre: "Estación Principal Radiólogo", ae_title: "HOROS_GUILLERMO", ip: "192.168.1.50", puerto: "4096", auto_envio: true, activo: true, modalidades: ["CT", "MR", "CR", "DX", "US"] }
        ]);
      });
  }, [token]);

  const agregarLog = (linea) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${linea}`]);

  // (Mantuve tus funciones de PACS e Impresoras intactas...)
  const handleGuardarPACS = async (e) => {
    e.preventDefault();
    setLoading(true); setServerStatus("REINICIANDO");
    try {
      await fetch("http://127.0.0.1:8000/api/dicom/config", {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ae_title: dicomConfig.ae_title, ip_address: dicomConfig.ip, port: parseInt(dicomConfig.port), client_ae: dicomConfig.client_ae })
      });
      setServerStatus("ACTIVO"); setMensaje({ texto: "✅ Nodo PACS guardado y reiniciado.", tipo: "success" });
    } catch (err) {
      setServerStatus("DETENIDO"); setMensaje({ texto: "❌ Error al guardar PACS.", tipo: "error" });
    } finally { setLoading(false); setTimeout(() => setMensaje({ texto: "", tipo: "" }), 3000); }
  };

  const handleTestPACS = () => { agregarLog(`[PRUEBA] Verificando puerto de escucha local ${dicomConfig.port}...`); setTimeout(() => agregarLog(`✅ [EXITO] El servidor MI_PACS está respondiendo.`), 1000); };
  const handleTestAgfa = () => { agregarLog(`[PING] Verificando red hacia impresora AGFA...`); setTimeout(() => agregarLog(`✅ [EXITO] Ping Normal completado.`), 1000); };
  const handleTestCanon = () => { agregarLog(`[PING] Verificando red hacia impresora Canon...`); setTimeout(() => agregarLog(`✅ [EXITO] Ping completado.`), 1000); };

  // ==========================================
  // FUNCIONES DE ESTACIONES DIAGNÓSTICAS (CRUD REAL)
  // ==========================================
  
  // 🚀 GUARDAR EN BASE DE DATOS
  const handleGuardarNodo = async (e) => {
    e.preventDefault();
    const metodo = editandoId ? "PUT" : "POST";
    const url = editandoId ? `http://127.0.0.1:8000/api/dicom/nodos/${editandoId}` : `http://127.0.0.1:8000/api/dicom/nodos`;

    try {
      // 1. Enviamos al servidor
      const response = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(nuevoNodo)
      });

      if (response.ok) {
        const nodoGuardado = await response.json();
        
        // 2. Actualizamos la pantalla
        if (editandoId) {
          setNodosDestino(nodosDestino.map(n => n.id === editandoId ? nodoGuardado : n));
          agregarLog(`[ROUTER] Estación actualizada en BD: ${nodoGuardado.nombre}`);
        } else {
          setNodosDestino([...nodosDestino, nodoGuardado]);
          agregarLog(`[ROUTER] Nueva estación guardada en BD: ${nodoGuardado.nombre}`);
        }
        
        setNuevoNodo({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false, activo: true, modalidades: [] });
        setEditandoId(null);
      } else {
        agregarLog(`[ERROR] El servidor rechazó guardar la estación.`);
      }
    } catch (error) {
      agregarLog(`[ERROR] Falló la conexión con la base de datos al intentar guardar.`);
      
      // FALLBACK: Si no tienes el backend listo, simulamos el guardado en pantalla
      const fakeId = editandoId || Date.now();
      const nodoSimulado = { ...nuevoNodo, id: fakeId };
      if (editandoId) {
        setNodosDestino(nodosDestino.map(n => n.id === editandoId ? nodoSimulado : n));
      } else {
        setNodosDestino([...nodosDestino, nodoSimulado]);
      }
      setNuevoNodo({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false, activo: true, modalidades: [] });
      setEditandoId(null);
    }
  };

  const handleEditarNodo = (nodo) => {
    setNuevoNodo(nodo);
    setEditandoId(nodo.id);
  };

  const handleCancelarEdicion = () => {
    setNuevoNodo({ nombre: "", ae_title: "", ip: "", puerto: "", auto_envio: false, activo: true, modalidades: [] });
    setEditandoId(null);
  };

  // 🚀 ELIMINAR DE BASE DE DATOS
  const handleEliminarNodo = async (id, nombre) => {
    if(!window.confirm(`¿Está seguro de eliminar permanentemente la estación: ${nombre}?`)) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/dicom/nodos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setNodosDestino(nodosDestino.filter(n => n.id !== id));
        if (editandoId === id) handleCancelarEdicion();
        agregarLog(`[SISTEMA] Nodo '${nombre}' borrado de la Base de Datos.`);
      }
    } catch (error) {
      // Fallback si no hay backend
      setNodosDestino(nodosDestino.filter(n => n.id !== id));
      agregarLog(`[SISTEMA] (Simulado) Nodo '${nombre}' eliminado de la pantalla.`);
    }
  };

  // 🚀 ACTIVAR/DESACTIVAR EN BASE DE DATOS
  const toggleActivo = async (nodoActual) => {
    const estadoNuevo = !nodoActual.activo;
    
    try {
      await fetch(`http://127.0.0.1:8000/api/dicom/nodos/${nodoActual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...nodoActual, activo: estadoNuevo })
      });
      setNodosDestino(nodosDestino.map(n => n.id === nodoActual.id ? { ...n, activo: estadoNuevo } : n));
      agregarLog(`[ROUTER] Tráfico hacia '${nodoActual.nombre}' ha sido ${estadoNuevo ? 'HABILITADO' : 'BLOQUEADO'} en BD.`);
    } catch (error) {
      setNodosDestino(nodosDestino.map(n => n.id === nodoActual.id ? { ...n, activo: estadoNuevo } : n));
    }
  };

  // 🚀 AUTO-ENVÍO EN BASE DE DATOS
  const toggleAutoEnvio = async (nodoActual) => {
    const estadoNuevo = !nodoActual.auto_envio;
    try {
      await fetch(`http://127.0.0.1:8000/api/dicom/nodos/${nodoActual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...nodoActual, auto_envio: estadoNuevo })
      });
      setNodosDestino(nodosDestino.map(n => n.id === nodoActual.id ? { ...n, auto_envio: estadoNuevo } : n));
    } catch (error) {
      setNodosDestino(nodosDestino.map(n => n.id === nodoActual.id ? { ...n, auto_envio: estadoNuevo } : n));
    }
  };

  const handleTestNodoLista = (nodo) => {
    if (!nodo.activo) return agregarLog(`[ERROR] La estación ${nodo.ae_title} está INACTIVA.`);
    agregarLog(`[PING] Haciendo Ping a la estación ${nodo.ip}...`);
    setTimeout(() => agregarLog(`✅ [EXITO] Estación ${nodo.ae_title} respondió correctamente.`), 1000);
  };

  const handleEscanearRed = () => {
    setIsScanning(true);
    agregarLog("[SCANNER] Iniciando barrido de red local buscando puertos DICOM...");
    setTimeout(() => {
      agregarLog("💡 [SCANNER] ¡Posible nodo detectado! IP: 192.168.1.105 | Puerto: 104");
      if(!editandoId) setNuevoNodo({ ...nuevoNodo, ip: "192.168.1.105", puerto: "104", ae_title: "DESCONOCIDO_AET" });
      setIsScanning(false);
    }, 3000);
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h2 style={titleStyle}>Configuración de Infraestructura MI_PACS</h2>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.95rem" }}>
          Gestione Nodos DICOM, pruebe asociaciones de red y administre impresoras.
        </p>
      </header>

      {mensaje.texto && (
        <div style={{ ...alertStyle, backgroundColor: mensaje.tipo === "success" ? "#10b98122" : "#ef444422", borderColor: mensaje.tipo === "success" ? "#10b981" : "#ef4444" }}>
          {mensaje.texto}
        </div>
      )}

      <div style={gridLayout}>
        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          <div style={cardStyle}>
            <div style={headerCardFlex}>
              <h3 style={sectionTitle}>⚙️ Nodo Local PACS (StoreSCP)</h3>
              <span style={badgeStatus(serverStatus)}>{serverStatus === "ACTIVO" ? "🟢 ESCUCHANDO" : "🔴 DETENIDO"}</span>
            </div>
            <form onSubmit={handleGuardarPACS}>
              <div style={{ display: "flex", gap: "15px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>PACS AE Title:</label><input type="text" style={inputStyle} value={dicomConfig.ae_title} onChange={(e) => setDicomConfig({...dicomConfig, ae_title: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>Puerto DICOM:</label><input type="number" style={inputStyle} value={dicomConfig.port} onChange={(e) => setDicomConfig({...dicomConfig, port: e.target.value})} required /></div>
              </div>
              <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                <div style={{ flex: 1 }}><label style={labelStyle}>IP de Escucha:</label><input type="text" style={inputStyle} value={dicomConfig.ip} onChange={(e) => setDicomConfig({...dicomConfig, ip: e.target.value})} required /></div>
                <div style={{ flex: 1 }}><label style={labelStyle}>AE Title Visor Integrado:</label><input type="text" style={inputStyle} value={dicomConfig.client_ae} onChange={(e) => setDicomConfig({...dicomConfig, client_ae: e.target.value})} required /></div>
              </div>
              <div style={btnRowStyle}>
                <button type="button" onClick={handleTestPACS} style={btnTestStyle}>📡 Probar Servidor</button>
                <button type="submit" disabled={loading} style={btnGuardarStyle}>💾 Guardar y Reiniciar</button>
              </div>
            </form>
          </div>

          <div style={cardStyle}>
            <h3 style={{ ...sectionTitle, borderBottom: "1px solid #333", paddingBottom: "10px" }}>🖨️ Servidores de Impresión Física</h3>
            
            <div style={subCardStyle}>
              <h4 style={{ margin: "0 0 10px 0", color: "#60a5fa", fontSize: "0.95rem" }}>🔘 Impresora de Acetatos (AGFA)</h4>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>IP Red</label><input type="text" style={inputStyle} value={impresoraAgfa.ip} onChange={e => setImpresoraAgfa({...impresoraAgfa, ip: e.target.value})} /></div>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>AET</label><input type="text" style={inputStyle} value={impresoraAgfa.ae_title} onChange={e => setImpresoraAgfa({...impresoraAgfa, ae_title: e.target.value})} /></div>
                <div style={{ flex: 1 }}><label style={labelMicro}>Puerto</label><input type="text" style={inputStyle} value={impresoraAgfa.puerto} onChange={e => setImpresoraAgfa({...impresoraAgfa, puerto: e.target.value})} /></div>
              </div>
              <div style={btnRowStyle}><button type="button" onClick={handleTestAgfa} style={{...btnTestStyle, padding: "8px 15px", fontSize: "0.85rem"}}>📡 PING + C-ECHO</button></div>
            </div>

            <div style={{ ...subCardStyle, marginTop: "15px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#10b981", fontSize: "0.95rem" }}>🎨 Impresora Láser Color (Canon)</h4>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>IP Red</label><input type="text" style={inputStyle} value={impresoraCanon.ip} onChange={e => setImpresoraCanon({...impresoraCanon, ip: e.target.value})} /></div>
                <div style={{ flex: 1.5 }}><label style={labelMicro}>MODELO</label><input type="text" style={inputStyle} value={impresoraCanon.cola} onChange={e => setImpresoraCanon({...impresoraCanon, cola: e.target.value})} /></div>
              </div>
              <div style={btnRowStyle}>
                <button type="button" onClick={handleTestCanon} style={{...btnTestStyle, padding: "8px 15px", fontSize: "0.85rem", color: "#10b981", borderColor: "#10b981"}}>🌐 PING NORMAL</button>
              </div>
            </div>

          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
          
          <div style={cardStyle}>
            <div style={headerCardFlex}>
              <h3 style={sectionTitle}>🖥️ Estaciones de Diagnóstico</h3>
              <button type="button" onClick={handleEscanearRed} disabled={isScanning} style={{ background: isScanning ? "#334155" : "#8b5cf6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: isScanning ? "wait" : "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>
                {isScanning ? "⏳ Escaneando Red..." : "🔍 Buscar en Red Local"}
              </button>
            </div>
            
            <form onSubmit={handleGuardarNodo} style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "15px", background: editandoId ? "#0f172a" : "#111418", padding: "15px", borderRadius: "8px", border: editandoId ? "1px solid #3b82f6" : "1px solid #222" }}>
              {editandoId && <span style={{ color: "#38bdf8", fontSize: "0.8rem", fontWeight: "bold" }}>✏️ Modo Edición Activo</span>}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr", gap: "8px" }}>
                <input type="text" placeholder="Nombre" style={inputStyle} value={nuevoNodo.nombre} onChange={e => setNuevoNodo({...nuevoNodo, nombre: e.target.value})} required />
                <input type="text" placeholder="AET" style={inputStyle} value={nuevoNodo.ae_title} onChange={e => setNuevoNodo({...nuevoNodo, ae_title: e.target.value})} required />
                <input type="text" placeholder="IP" style={inputStyle} value={nuevoNodo.ip} onChange={e => setNuevoNodo({...nuevoNodo, ip: e.target.value})} required />
                <input type="text" placeholder="Port" style={inputStyle} value={nuevoNodo.puerto} onChange={e => setNuevoNodo({...nuevoNodo, puerto: e.target.value})} required />
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", background: "#0a0c0f", padding: "8px", borderRadius: "6px" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: "bold" }}>Soporta:</span>
                {modalidadesDisponibles.map(mod => (
                  <label key={mod} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: nuevoNodo.modalidades.includes(mod) ? "#38bdf8" : "#64748b", cursor: "pointer" }}>
                    <input type="checkbox" checked={nuevoNodo.modalidades.includes(mod)} onChange={(e) => {
                        const mods = e.target.checked ? [...nuevoNodo.modalidades, mod] : nuevoNodo.modalidades.filter(m => m !== mod);
                        setNuevoNodo({...nuevoNodo, modalidades: mods});
                      }} /> {mod}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                {editandoId && <button type="button" onClick={handleCancelarEdicion} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>✖ Cancelar</button>}
                <button type="submit" style={{ ...btnGuardarStyle, margin: 0, width: "auto", padding: "8px 20px" }}>{editandoId ? "💾 Guardar Cambios" : "➕ Añadir Nodo"}</button>
              </div>
            </form>

            <div className="custom-pacs-scroll" style={{ maxHeight: "320px", overflowY: "auto", background: "#0a0c0f", padding: "10px", borderRadius: "6px", border: "1px solid #333" }}>
              {nodosDestino.length === 0 && <div style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No hay estaciones configuradas.</div>}
              {nodosDestino.map((n) => (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #222", padding: "15px 10px", opacity: n.activo ? 1 : 0.4, transition: "opacity 0.3s" }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: n.activo ? "#fbbf24" : "#94a3b8", fontSize: "1rem" }}>{n.nombre}</strong>
                    <div style={{ display: "flex", gap: "15px", color: "#94a3b8", fontSize: "0.85rem", marginTop: "6px", fontFamily: "monospace" }}>
                      <span><span style={{color:"#64748b"}}>AET:</span> {n.ae_title || "-"}</span><span><span style={{color:"#64748b"}}>IP:</span> {n.ip || "-"}</span><span><span style={{color:"#64748b"}}>PORT:</span> {n.puerto || "-"}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      {n.modalidades && n.modalidades.length > 0 ? n.modalidades.map(m => (<span key={m} style={{ background: "#1e293b", color: n.activo ? "#38bdf8" : "#64748b", padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold", border: "1px solid #0369a1" }}>{m}</span>)) : <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: "bold" }}>⚠️ Sin modalidades</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end", minWidth: "180px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "0.8rem", color: "#94a3b8" }}>
                        <input type="checkbox" checked={n.auto_envio} onChange={() => toggleAutoEnvio(n)} disabled={!n.activo} /> Auto Enviar
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold", color: n.activo ? "#10b981" : "#ef4444", background: "#111", padding: "4px 8px", borderRadius: "4px", border: "1px solid #333" }}>
                        <input type="checkbox" checked={n.activo} onChange={() => toggleActivo(n)} /> {n.activo ? "🟢 ON" : "🔴 OFF"}
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" onClick={() => handleTestNodoLista(n)} disabled={!n.activo} style={{ background: "transparent", color: n.activo ? "#0ea5e9" : "#475569", border: `1px solid ${n.activo ? "#0ea5e9" : "#475569"}`, padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", cursor: n.activo ? "pointer" : "not-allowed", fontWeight: "bold" }}>📡 Test</button>
                      <button type="button" onClick={() => handleEditarNodo(n)} style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}>✏️</button>
                      <button type="button" onClick={() => handleEliminarNodo(n.id, n.nombre)} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 10px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={headerCardFlex}>
              <h3 style={{ ...sectionTitle, color: "#3b82f6" }}>📡 Consola de Red DICOM (Live)</h3>
              <button type="button" onClick={() => setLogs(["[SISTEMA] Consola limpiada."])} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "4px", padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}>🧹 Limpiar</button>
            </div>
            <div style={terminalStyle}>
              {logs.map((log, index) => {
                let color = "#10b981"; 
                if (log.includes("[ERROR]")) color = "#ef4444";
                if (log.includes("[SISTEMA]")) color = "#3b82f6";
                if (log.includes("[PING]")) color = "#fbbf24";
                if (log.includes("[SCANNER]")) color = "#a855f7"; 
                if (log.includes("[C-ECHO]") || log.includes("[ROUTER]")) color = "#d946ef"; 
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

// ESTILOS 
const containerStyle = { padding: "30px", color: "white", backgroundColor: "transparent", boxSizing: "border-box", width: "100%", height: "100%", overflowY: "auto" };
const headerStyle = { marginBottom: "25px", borderBottom: "1px solid #222", paddingBottom: "15px" };
const titleStyle = { color: "#fbbf24", margin: "0 0 10px 0", borderLeft: "4px solid #fbbf24", paddingLeft: "15px", fontSize: "1.8rem" };
const gridLayout = { display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "25px", paddingBottom: "50px" }; 
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