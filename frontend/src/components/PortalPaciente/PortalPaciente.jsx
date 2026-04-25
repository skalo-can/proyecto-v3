import React, { useState, useEffect } from "react";
import "./PortalPaciente.css";

export const PortalPaciente = ({ estudioData }) => {
  const [validado, setValidado] = useState(false);
  const [pin, setPin] = useState("");

  // Esto nos confirmará en la consola (F12) que el archivo está cargado
  useEffect(() => {
    console.log("✅ Componente PortalPaciente cargado correctamente.");
  }, []);

  const handleAcceso = () => {
    if (pin === "1234") {
      setValidado(true);
    } else {
      alert("PIN incorrecto. Use 1234 para la prueba.");
    }
  };

  // VISTA 1: ACCESO SEGURO (EL BOTÓN DORADO)
  if (!validado) {
    return (
      <div className="portal-login-container" style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'radial-gradient(circle at center, #1a1a1a 0%, #000 100%)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 999999, color: 'white', margin: 0, padding: 0
      }}>
        <div className="portal-card-paciente" style={{
          background: 'rgba(30, 30, 30, 0.95)', padding: '50px', borderRadius: '24px',
          border: '2px solid #fbbf24', textAlign: 'center', width: '350px',
          boxShadow: '0 0 40px rgba(251, 191, 36, 0.3)', display: 'block'
        }}>
          <h2 style={{ color: '#fbbf24', fontSize: '1.8rem', marginBottom: '10px', fontWeight: 'bold' }}>
            🔐 ACCESO SEGURO
          </h2>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '25px' }}>
            SISTEMA DE PACIENTES MI_PACS
          </p>
          
          <input 
            type="password" 
            placeholder="PIN DE ACCESO" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{
              width: '100%', padding: '15px', background: '#000', border: '1px solid #444',
              borderRadius: '10px', color: '#fbbf24', fontSize: '1.2rem', textAlign: 'center',
              marginBottom: '20px', outline: 'none'
            }}
          />

          <button 
            onClick={handleAcceso} 
            className="btn-portal-confirmar"
            style={{
              width: '100%', padding: '18px', background: '#fbbf24', color: '#000',
              fontWeight: '900', border: 'none', borderRadius: '12px', cursor: 'pointer',
              fontSize: '1rem', boxShadow: '0 4px 15px rgba(251, 191, 36, 0.4)'
            }}
          >
            VERIFICAR IDENTIDAD
          </button>
        </div>
      </div>
    );
  }

  // VISTA 2: EL PORTAL INTERNO (SE ACTIVA CON EL PIN 1234)
  return (
    <div className="portal-paciente-container" style={{ background: '#000', minHeight: '100vh', color: 'white', padding: '20px' }}>
      <header style={{ borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '1.5rem' }}>MI_PACS <span style={{ color: '#fbbf24' }}>PATIENT PORTAL</span></h1>
      </header>
      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3 style={{ color: '#fbbf24' }}>📄 RESULTADOS DISPONIBLES</h3>
          <p>Bienvenido. Aquí podrá consultar sus imágenes y reportes.</p>
        </div>
      </main>
    </div>
  );
};