import React, { useState, useEffect } from "react";

export default function ModalEnviarEstudios({ isOpen, onClose, estudiosSeleccionados }) {
  const [nodos, setNodos] = useState([]);
  const [nodoSeleccionado, setNodoSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setLogs([]);
      setNodoSeleccionado("");
      setLoading(true);

      // 🚀 1. Llamada REAL al backend blindada contra errores
      fetch('http://192.168.5.21:8000/api/nodos', { 
        headers: { 
          // Si usas el contexto de autenticación, pasa el token aquí:
          // 'Authorization': `Bearer ${token}` 
        }
      })
      .then(res => {
        if (!res.ok) throw new Error("La ruta /api/nodos no existe o dio error");
        return res.json();
      })
      .then(data => {
        // 🔥 VALIDACIÓN CRÍTICA: Asegurarnos de que 'data' sea un Array antes de guardarlo
        if (Array.isArray(data)) {
          setNodos(data);
        } else {
          setNodos([]);
          setLogs(["❌ [ERROR] El servidor no devolvió una lista válida de nodos."]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error al cargar nodos reales:", err);
        setNodos([]); // 🛡️ Evita que la pantalla se ponga negra asignando un array vacío
        setLogs(["❌ [ERROR] No se pudo contactar al servidor para cargar los nodos."]);
        setLoading(false);
      });
    }
  }, [isOpen]); // Si usas token, agrégalo a las dependencias: [isOpen, token]

  if (!isOpen) return null;

  // Extraer las modalidades únicas dando prioridad absoluta a 'tipo_estudio'
  const modalidadesAEnviar = [...new Set(estudiosSeleccionados.map(e => {
    // 🚀 Leemos primero tipo_estudio. Si por algún motivo dice "OTRO", ignoramos y pasamos a la siguiente.
    let mod = (e.tipo_estudio && e.tipo_estudio !== "OTRO") ? e.tipo_estudio : 
              (e.modality && e.modality !== "OTRO") ? e.modality : 
              "OTRO";
    
    // Por si el backend alguna vez lo manda como un array
    if (Array.isArray(mod)) {
      mod = mod[0];
    }
    
    return String(mod).toUpperCase();
  }))];

  const handleEnviar = async () => {
    if (!nodoSeleccionado) return;
    
    setLoading(true);
    const nodoDestinoInfo = nodos.find(n => n.ae_title === nodoSeleccionado);
    setLogs(prev => [...prev, `[SISTEMA] Preparando envío de ${estudiosSeleccionados.length} estudio(s)...`]);
    setLogs(prev => [...prev, `[C-STORE] Conectando con ${nodoDestinoInfo.nombre || nodoDestinoInfo.ae_title}...`]);

    try {
      // 🚀 1. Buscamos tu llave de acceso en el navegador
      const token = localStorage.getItem("token"); // O usa tu AuthContext si lo prefieres

      // 🚀 2. Disparador REAL con la llave de seguridad incluida
      const response = await fetch("http://192.168.5.21:8000/api/dicom/send", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // 🔥 ¡AQUÍ ESTÁ LA MAGIA! Descomentado.
        },
        body: JSON.stringify({ 
          destino_aet: nodoSeleccionado, 
          estudios_ids: estudiosSeleccionados.map(e => e.id) 
        })
      });

      if (response.ok) {
        setLogs(prev => [...prev, `✅ [EXITO] Transferencia DICOM iniciada en el servidor.`]);
      } else {
        const errorData = await response.json();
        setLogs(prev => [...prev, `❌ [ERROR] Rechazado por el servidor: ${errorData.detail || 'Fallo desconocido'}`]);
      }
    } catch (error) {
      setLogs(prev => [...prev, `❌ [ERROR] Falla de red: ${error.message}`]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#1e293b", padding: "25px", borderRadius: "12px", width: "550px", border: "1px solid #334155", color: "#fff", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
        
        <h3 style={{ margin: "0 0 15px 0", color: "#fbbf24", borderBottom: "1px solid #334155", paddingBottom: "10px" }}>
          📤 Enviar Estudios (Filtro por Modalidad)
        </h3>
        
        <div style={{ background: "#0f172a", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem" }}>
          <p style={{ margin: "0 0 8px 0", color: "#cbd5e1" }}>Ha seleccionado <strong>{estudiosSeleccionados.length}</strong> estudio(s).</p>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Modalidades en este envío:</span>
            {modalidadesAEnviar.map(mod => (
              <span key={mod} style={{ background: "#38bdf822", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", border: "1px solid #0369a1" }}>
                {mod}
              </span>
            ))}
          </div>
        </div>

        <label style={{ display: "block", color: "#94a3b8", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px" }}>
          Seleccione Estación de Destino:
        </label>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", maxHeight: "150px", overflowY: "auto" }}>
          {nodos.map(n => {
            // Verificar si el nodo soporta TODAS las modalidades que se están intentando enviar
            const esCompatible = modalidadesAEnviar.every(mod => n.modalidades?.includes(mod));
            
            return (
              <label 
                key={n.id} 
                style={{ 
                  display: "flex", alignItems: "center", gap: "10px", padding: "12px", 
                  background: esCompatible ? "#111827" : "#1e1e1e", 
                  border: `1px solid ${nodoSeleccionado === n.ae_title ? "#3b82f6" : "#333"}`, 
                  borderRadius: "8px", cursor: esCompatible ? "pointer" : "not-allowed",
                  opacity: esCompatible ? 1 : 0.5
                }}
              >
                <input 
                  type="radio" 
                  name="nodoDestino" 
                  value={n.ae_title} 
                  checked={nodoSeleccionado === n.ae_title}
                  onChange={(e) => esCompatible && setNodoSeleccionado(e.target.value)}
                  disabled={!esCompatible || loading}
                  style={{ cursor: esCompatible ? "pointer" : "not-allowed" }}
                />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.95rem", color: esCompatible ? "#fff" : "#666" }}>
                    {n.nombre} <span style={{ fontSize: "0.75rem", color: "#888" }}>({n.ae_title})</span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                    Soporta: {n.modalidades?.join(", ")}
                  </div>
                </div>
                {!esCompatible && <span style={{ fontSize: "0.7rem", color: "#ef4444", fontWeight: "bold", background: "#ef444422", padding: "2px 6px", borderRadius: "4px" }}>Incompatible</span>}
              </label>
            );
          })}
        </div>

        {/* Consola de Logs */}
        {logs.length > 0 && (
          <div style={{ background: "#000", border: "1px solid #334155", borderRadius: "6px", padding: "10px", height: "100px", overflowY: "auto", fontFamily: "monospace", fontSize: "0.8rem", marginBottom: "20px" }}>
            {logs.map((log, index) => (
              <div key={index} style={{ color: log.includes("ERROR") ? "#ef4444" : log.includes("EXITO") ? "#10b981" : "#3b82f6", marginBottom: "4px" }}>
                {log}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} disabled={loading} style={{ background: "transparent", color: "#cbd5e1", border: "1px solid #475569", padding: "10px 15px", borderRadius: "6px", cursor: "pointer" }}>
            Cerrar
          </button>
          <button 
            onClick={handleEnviar} 
            disabled={loading || !nodoSeleccionado} 
            style={{ background: loading || !nodoSeleccionado ? "#334155" : "#2563eb", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: loading || !nodoSeleccionado ? "not-allowed" : "pointer", fontWeight: "bold" }}
          >
            {loading ? "Enviando..." : "🚀 Iniciar Envío (C-STORE)"}
          </button>
        </div>

      </div>
    </div>
  );
}