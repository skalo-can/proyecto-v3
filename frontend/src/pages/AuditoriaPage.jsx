import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertOctagon, CheckCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import "./AuditoriaPage.css";

export default function AuditoriaPage() {
  const { token } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAuditoria();
  }, [token]);

  const fetchAuditoria = async () => {
    try {
      setCargando(true);
      // 🔥 SOLUCIÓN: Ruta dinámica. Si estás en la web usa tu dominio, si estás local usa localhost
      const apiBase = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
        ? 'http://localhost:8000' 
        : window.location.origin;

      const response = await fetch(`${apiBase}/auditoria/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRegistros(data);
      } else {
        setError("No se pudo cargar la auditoría.");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión al cargar la auditoría.");
    } finally {
      setCargando(false);
    }
  };

  const renderResultado = (resultado) => {
    const res = String(resultado).toLowerCase();
    switch (res) {
      case 'ok':
      case 'éxito':
      case 'autorizado':
        return <span style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14}/> Autorizado</span>;
      case 'denegado':
      case 'bloqueado':
        return <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldAlert size={14}/> Bloqueado</span>;
      case 'expirado':
        return <span style={{ color: '#fbbf24', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertOctagon size={14}/> Expirado</span>;
      default:
        return <span style={{ color: '#a0aabf', textTransform: 'capitalize' }}>{resultado}</span>;
    }
  };

  return (
    <div className="auditoria-container">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          {/* 🔥 EVOLUCIÓN: Título actualizado para reflejar la Auditoría General */}
          <h1 className="auditoria-title" style={{ marginBottom: '5px' }}>
            🛡️ Auditoría General del Sistema
          </h1>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 12px', borderRadius: '15px', border: '1px solid #fbbf24', fontSize: '10px', fontWeight: '800', display: 'inline-block' }}>
            REGISTRO DE SEGURIDAD, ACCESOS Y DESCARGAS
          </div>
        </div>
        <button className="volver-btn" onClick={() => window.history.back()} style={{ margin: 0 }}>
          ⬅ Volver
        </button>
      </div>

      <div className="auditoria-card">
        {cargando ? (
          <div style={{ textAlign: 'center', color: '#fbbf24', marginTop: '40px', fontWeight: 'bold' }}>
            ⏳ Consultando registros de seguridad...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#ef4444', marginTop: '40px' }}>
            <p>⚠️ {error}</p>
            <button onClick={() => window.location.reload()} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>
              Reintentar
            </button>
          </div>
        ) : (
          <table className="auditoria-table">
            <thead>
              {/* 🔥 EVOLUCIÓN: Columnas genéricas preparadas para eventos de seguridad y descargas clínicas */}
              <tr>
                <th>ID</th>
                <th>Objetivo (Usuario/Paciente)</th>
                <th>Evento / Detalle</th>
                <th>IP Origen</th>
                <th>Resultado</th>
                <th>Fecha de Evento</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No hay registros de auditoría en el sistema.
                  </td>
                </tr>
              ) : (
                registros.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', color: '#fbbf24' }}>#{row.id}</td>
                    <td style={{ fontWeight: 'bold', color: '#fff' }}>{row.paciente || row.usuario || '-'}</td>
                    <td style={{ color: '#38bdf8' }}>{row.estudio || row.evento || '-'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{row.ip}</td>
                    <td>{renderResultado(row.resultado)}</td>
                    <td style={{ color: '#94a3b8' }}>{row.fecha}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}