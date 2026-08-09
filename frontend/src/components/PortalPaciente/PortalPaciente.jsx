import React, { useState } from "react";
import { useParams } from "react-router-dom"; 
import { useAuth } from "../../AuthContext";
import "./PortalPaciente.css";

import VisorDICOMWrapper from "../../VisorDICOMWrapper";

export const PortalPaciente = () => {
  const { token } = useParams(); 
  const { user } = useAuth();
  
  const [validado, setValidado] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); 
  const [validandoPin, setValidandoPin] = useState(false); 
  const [estudioData, setEstudioData] = useState(null); 
  const [vistasRestantes, setVistasRestantes] = useState(null); 
  
  // 🔥 NUEVO ESTADO: Controla si el PIN se muestra como texto o asteriscos
  const [mostrarPin, setMostrarPin] = useState(false);
  
  const [loadingEstudio, setLoadingEstudio] = useState(false);
  const [mostrarVisor, setMostrarVisor] = useState(false);

  const handleAcceso = async () => {
    if (!pin || pin.length < 4) return;
    
    setValidandoPin(true);
    setError(false);
    setErrorMsg("");

    try {
      const apiBase = window.location.origin;
      
      const response = await fetch(`${apiBase}/api/secure-links/validar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, pin: pin })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Identidad no verificada");
      }
      
      if (data.acceso_permitido) {
        setEstudioData(data.estudio); 
        setVistasRestantes(data.vistas_restantes); 
        setValidado(true);
        setPin("");
      }
    } catch (err) {
      console.error(err);
      setError(true);
      setErrorMsg(err.message);
      setPin("");
      setTimeout(() => {
        setError(false);
        setErrorMsg("");
      }, 3500); 
    } finally {
      setValidandoPin(false);
    }
  };

  const activarVisor = () => {
    setLoadingEstudio(true);
    setTimeout(() => {
      setLoadingEstudio(false);
      setMostrarVisor(true);
    }, 4000); 
  };

  const abrirInforme = () => {
    const apiBase = window.location.origin;
    window.open(`${apiBase}/api/secure-links/informe/${token}`, "_blank");
  };

  if (!validado) {
    return (
      <div className="portal-login-container">
        <div className={`portal-card-paciente ${error ? 'shake-error' : ''}`}>
          <div className="portal-icon-header">🔐</div>
          <h2 className="portal-title">ACCESO SEGURO</h2>
          
          <div style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderLeft: '4px solid #fbbf24', padding: '12px', borderRadius: '4px', color: '#fbbf24', marginBottom: '20px', fontSize: '13px', textAlign: 'left', lineHeight: '1.4' }}>
            <strong>🔒 Enlace de Alta Seguridad:</strong> Por protección de sus datos médicos, este enlace tiene un <strong>límite de 4 visualizaciones</strong> y expirará al alcanzarlas. Le recomendamos descargar su informe PDF en su primera visita.
          </div>

          {/* 🔥 CONTENEDOR DEL PIN CON ICONO DE OJO Y EVENTO ENTER */}
          <div style={{ position: "relative", width: "100%" }}>
            <input 
              type={mostrarPin ? "text" : "password"} 
              placeholder="PIN DE ACCESO (DDMMAAAA)" 
              value={pin}
              autoComplete="off"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin.length >= 4 && !validandoPin) {
                  handleAcceso();
                }
              }}
              maxLength={8}
              className="portal-input-pin"
              disabled={validandoPin}
              style={{ 
                paddingRight: "45px",
                // 🔥 Anulamos cualquier regla de CSS (.portal-input-pin) que esté forzando los puntos
                WebkitTextSecurity: mostrarPin ? "none" : "unset",
                fontFamily: mostrarPin ? "monospace" : "inherit",
                letterSpacing: mostrarPin ? "3px" : "normal"
              }} 
            />
            <span 
              onClick={() => !validandoPin && setMostrarPin(!mostrarPin)}
              style={{
                position: "absolute",
                right: "15px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: validandoPin ? "not-allowed" : "pointer",
                fontSize: "18px",
                opacity: validandoPin ? 0.5 : 1,
                userSelect: "none",
                zIndex: 10 // 🔥 Aseguramos que siempre esté por encima de la barra
              }}
              title={mostrarPin ? "Ocultar PIN" : "Mostrar PIN"}
            >
              {mostrarPin ? "👁️" : "🙈"}
            </span>
          </div>
          
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              marginTop: '15px',
              textAlign: 'center',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}>
              ⚠️ {errorMsg.toUpperCase() || "IDENTIDAD NO VERIFICADA"}
            </div>
          )}
          
          <button 
            onClick={handleAcceso} 
            className="btn-portal-confirmar"
            disabled={validandoPin || pin.length === 0}
            style={{ marginTop: '15px' }}
          >
            {validandoPin ? "VERIFICANDO..." : "VERIFICAR IDENTIDAD"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-interno-layout">
      <header className="portal-interno-header">
        <div className="portal-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1 className="portal-logo-text">MI_PACS <span className="gold-text">GLOBAL PORTAL</span></h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {vistasRestantes !== null && (
              <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '6px 10px', borderRadius: '20px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                👁️ VISUALIZACIONES RESTANTES: {vistasRestantes}
              </span>
            )}

            <button onClick={() => mostrarVisor ? setMostrarVisor(false) : window.location.reload()} className="btn-exit-luxury">
              {mostrarVisor ? "VOLVER / BACK" : "SALIR / EXIT"}
            </button>
          </div>
        </div>
      </header>

      <main className="portal-interno-main">
        {!mostrarVisor ? (
          <>
            <div className="welcome-section-luxury">
              <h2 className="gold-text">BIENVENIDO / WELCOME</h2>
              <p className="subtitle-luxury">
                Sincronizando los estudios de <strong>{estudioData?.paciente_nombre || "Paciente"}</strong> con la red global...
              </p>
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
          <div className="visor-paciente-main">
            <div className="visor-sidebar-gold">
              <button 
                className="tool-gold-btn highlight" 
                onClick={abrirInforme}
                title="Ver y Descargar Reporte Radiológico"
              >
                📋<span>Informe</span>
              </button>
            </div>
            
            <div className="visor-viewport-luxury">
              <div className="viewport-header-info">
                PACIENTE: {estudioData?.paciente_nombre || "DESCONOCIDO"} | MODALIDAD: {estudioData?.modalidad || "N/A"}
              </div>
              <div className="canvas-luxury-area" style={{ height: '70vh', width: '100%', position: 'relative' }}>
                <VisorDICOMWrapper 
                  estudioId={estudioData?.id} 
                  tokenPaciente={token} 
                  esPortalPaciente={true} 
                />
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