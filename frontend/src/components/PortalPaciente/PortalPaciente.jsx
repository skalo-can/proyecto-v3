import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import "./PortalPaciente.css";

export const PortalPaciente = () => {
  const { user } = useAuth();
  const [validado, setValidado] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  
  // 🚀 Nuevos estados para controlar la transición al visor
  const [loadingEstudio, setLoadingEstudio] = useState(false);
  const [mostrarVisor, setMostrarVisor] = useState(false);

  const handleAcceso = () => {
    const masterKey = "18101974"; 
    if (pin === masterKey) {
      setValidado(true);
      setPin("");
      setError(false);
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 2000);
    }
  };

  // Función para simular la carga y abrir el visor
  const activarVisor = () => {
    setLoadingEstudio(true);
    setTimeout(() => {
      setLoadingEstudio(false);
      setMostrarVisor(true);
    }, 4000); // 4 segundos de carga de lujo
  };

  if (!validado) {
    return (
      <div className="portal-login-container">
        <div className={`portal-card-paciente ${error ? 'shake-error' : ''}`}>
          <div className="portal-icon-header">🔐</div>
          <h2 className="portal-title">ACCESO SEGURO</h2>
          <input 
            type="password" 
            placeholder="PIN DE ACCESO" 
            value={pin}
            autoComplete="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
            maxLength={8}
            className="portal-input-pin"
          />
          {error && <p className="error-text">⚠️ IDENTIDAD NO VERIFICADA</p>}
          <button onClick={handleAcceso} className="btn-portal-confirmar">
            VERIFICAR IDENTIDAD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-interno-layout">
      {/* HEADER DE LUJO */}
      <header className="portal-interno-header">
        <div className="portal-header-content">
          <h1 className="portal-logo-text">MI_PACS <span className="gold-text">GLOBAL PORTAL</span></h1>
          <button onClick={() => mostrarVisor ? setMostrarVisor(false) : window.location.reload()} className="btn-exit-luxury">
            {mostrarVisor ? "VOLVER / BACK" : "SALIR / EXIT"}
          </button>
        </div>
      </header>

      <main className="portal-interno-main">
        {!mostrarVisor ? (
          <>
            <div className="welcome-section-luxury">
              <h2 className="gold-text">BIENVENIDO / WELCOME</h2>
              <p className="subtitle-luxury">Sincronizando sus estudios médicos con la red global...</p>
            </div>

            <div className="estudios-grid-luxury">
               <div className="estudio-card-luxury" onClick={!loadingEstudio ? activarVisor : null} style={{cursor: 'pointer'}}>
                  <div className="card-shine"></div>
                  <div className="estudio-icon-gold">🔬</div>
                  <div className="estudio-details-luxury">
                    <h4 className="gold-text">ESTUDIO ENCONTRADO / STUDY FOUND</h4>
                    <p>{loadingEstudio ? "Cargando imágenes en alta resolución..." : "Haga clic para abrir el visor de imágenes y su informe."}</p>
                    
                    {loadingEstudio ? (
                      <div className="loading-bar-gold">
                        <div className="loading-progress"></div>
                      </div>
                    ) : (
                      <div className="tap-to-open gold-text">TAP TO OPEN / CLIC PARA ABRIR</div>
                    )}
                  </div>
               </div>
            </div>
          </>
        ) : (
          /* 🖼️ VISOR CINEMATOGRÁFICO DE PACIENTE */
          <div className="visor-paciente-main">
            <div className="visor-sidebar-gold">
              <button className="tool-gold-btn">☀️<span>Brillo</span></button>
              <button className="tool-gold-btn">🌗<span>Contraste</span></button>
              <button className="tool-gold-btn">🔍<span>Zoom</span></button>
              <div className="sep-gold"></div>
              <button className="tool-gold-btn highlight">📋<span>Informe</span></button>
            </div>
            
            <div className="visor-viewport-luxury">
              <div className="viewport-header-info">PACIENTE: {user?.nombre || "DEMO USER"} | MODALIDAD: CT</div>
              <div className="canvas-luxury-area">
                <div className="cornerstone-mock">
                   <div className="scan-line"></div>
                   <span className="loading-text-gold">Sincronizando Capas...</span>
                </div>
              </div>
              <div className="viewport-footer-info">MI_PACS HIGH DEFINITION VIEWING</div>
            </div>
          </div>
        )}
      </main>

      <footer className="portal-footer-luxury">
        <p>🔒 MI_PACS SYSTEM | SECURE MEDICAL NETWORK</p>
      </footer>
    </div>
  );
};