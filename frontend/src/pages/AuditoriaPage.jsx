import React, { useState, useEffect } from "react";
import { ShieldAlert, AlertOctagon, CheckCircle } from "lucide-react";
import { useAuth } from "../AuthContext"; // Asegúrate de que esta ruta sea correcta según tu proyecto
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
      // 🚀 Apuntamos a la nueva ruta enriquecida del backend
      const response = await fetch("http://127.0.0.1:8000/api/auditoria/dashboard", {
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

  // Función para pintar el resultado con iconos y colores dinámicos
  const renderResultado = (resultado) => {
    const res = String(resultado).toLowerCase();
    switch (res) {
      case 'ok':
      case 'éxito':
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

  if (cargando) return <div className="auditoria-loading" style={{ color: 'white', padding: '20px' }}><p>Cargando registros de seguridad...</p></div>;
  if (error) return <div className="auditoria-error" style={{ color: '#ef4444', padding: '20px' }}><p>{error}</p></div>;

  return (
    <div className="auditoria-container" style={{ padding: '20px', color: 'white', backgroundColor: '#0f1114', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Título principal */}
      <h1 className="auditoria-title" style={{ color: '#fbbf24', marginBottom: '25px', fontSize: '1.5rem' }}>
        Auditoría de Descargas
      </h1>

      {/* Contenedor oscuro con scroll interno */}
      <div className="auditoria-card" style={{ background: '#1a1d26', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden', marginBottom: '20px' }}>
        <table className="auditoria-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #FFD700', backgroundColor: '#11141a' }}>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>ID</th>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>Paciente</th>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>Estudio</th>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>IP Origen</th>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>Resultado</th>
              <th style={{ padding: '12px 15px', color: '#FFD700', fontWeight: 'bold' }}>Fecha de Evento</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#a0aabf' }}>
                  No hay registros de auditoría
                </td>
              </tr>
            ) : (
              registros.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #2a303c', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 15px', color: '#a0aabf', fontFamily: 'monospace' }}>#{row.id}</td>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#fff' }}>{row.paciente}</td>
                  <td style={{ padding: '12px 15px', color: '#38bdf8' }}>{row.estudio}</td>
                  <td style={{ padding: '12px 15px', fontFamily: 'monospace', color: '#cbd5e1' }}>{row.ip}</td>
                  <td style={{ padding: '12px 15px' }}>{renderResultado(row.resultado)}</td>
                  <td style={{ padding: '12px 15px', color: '#94a3b8' }}>{row.fecha}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button className="volver-btn" onClick={() => window.history.back()} style={{ background: '#333', color: 'white', border: '1px solid #555', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
        ⬅ Volver
      </button>
    </div>
  );
}