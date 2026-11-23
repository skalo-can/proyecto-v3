import React, { useState } from "react";
import { useParams } from "react-router-dom"; 
import { useTranslation } from "react-i18next";
import { useAuth } from "../../AuthContext";
import "./PortalPaciente.css";

import VisorDICOMWrapper from "../../VisorDICOMWrapper";

export const PortalPaciente = () => {
  const { token } = useParams(); 
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  
  const [validado, setValidado] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); 
  const [validandoPin, setValidandoPin] = useState(false); 
  const [estudioData, setEstudioData] = useState(null); 
  const [vistasRestantes, setVistasRestantes] = useState(null); 
  
  // Controla si el PIN se muestra como texto o asteriscos
  const [mostrarPin, setMostrarPin] = useState(false);
  
  const [loadingEstudio, setLoadingEstudio] = useState(false);
  const [mostrarVisor, setMostrarVisor] = useState(false);

  const apiBase = window.location.origin.includes(":5173")
    ? "http://192.168.5.21:8000"
    : window.location.origin;

  const toggleIdioma = () => {
    i18n.changeLanguage(isEn ? "es" : "en");
  };

  const handleAcceso = async () => {
    if (!pin || pin.length < 4) return;
    
    setValidandoPin(true);
    setError(false);
    setErrorMsg("");

    try {
      const response = await fetch(`${apiBase}/api/secure-links/validar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, pin: pin })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || (isEn ? "Identity not verified" : "Identidad no verificada"));
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
    window.open(`${apiBase}/api/secure-links/informe/${token}`, "_blank");
  };

  if (!validado) {
    return (
      <div className="portal-login-container">
        <div className={`portal-card-paciente ${error ? 'shake-error' : ''}`} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={toggleIdioma}
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              background: "#1e293b",
              color: "#fbbf24",
              border: "1px solid #334155",
              borderRadius: "20px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            🌐 {isEn ? "ES" : "EN"}
          </button>

          <div className="portal-icon-header">🔐</div>
          <h2 className="portal-title">{isEn ? "SECURE ACCESS" : "ACCESO SEGURO"}</h2>
          
          <div style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderLeft: '4px solid #fbbf24', padding: '12px', borderRadius: '4px', color: '#fbbf24', marginBottom: '20px', fontSize: '13px', textAlign: 'left', lineHeight: '1.4' }}>
            {isEn ? (
              <>
                <strong>🔒 High-Security Link:</strong> To protect your medical data, this link has a <strong>limit of 4 views</strong> and will expire once reached. We recommend downloading your PDF report on your first visit.
              </>
            ) : (
              <>
                <strong>🔒 Enlace de Alta Seguridad:</strong> Por protección de sus datos médicos, este enlace tiene un <strong>límite de 4 visualizaciones</strong> y expirará al alcanzarlas. Le recomendamos descargar su informe PDF en su primera visita.
              </>
            )}
          </div>

          {/* CONTENEDOR DEL PIN CON ICONO DE OJO Y EVENTO ENTER */}
          <div style={{ position: "relative", width: "100%" }}>
            <input 
              type={mostrarPin ? "text" : "password"} 
              placeholder={isEn ? "ACCESS PIN (DDMMYYYY)" : "PIN DE ACCESO (DDMMAAAA)"} 
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
                zIndex: 10
              }}
              title={
                isEn
                  ? mostrarPin ? "Hide PIN" : "Show PIN"
                  : mostrarPin ? "Ocultar PIN" : "Mostrar PIN"
              }
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
              ⚠️ {errorMsg.toUpperCase() || (isEn ? "IDENTITY NOT VERIFIED" : "IDENTIDAD NO VERIFICADA")}
            </div>
          )}
          
          <button 
            onClick={handleAcceso} 
            className="btn-portal-confirmar"
            disabled={validandoPin || pin.length === 0}
            style={{ marginTop: '15px' }}
          >
            {validandoPin
              ? isEn ? "VERIFYING..." : "VERIFICANDO..."
              : isEn ? "VERIFY IDENTITY" : "VERIFICAR IDENTIDAD"}
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
                {isEn
                  ? `👁️ REMAINING VIEWS: ${vistasRestantes}`
                  : `👁️ VISUALIZACIONES RESTANTES: ${vistasRestantes}`}
              </span>
            )}

            <button
              type="button"
              onClick={toggleIdioma}
              style={{
                background: "#1e293b",
                color: "#fbbf24",
                border: "1px solid #334155",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              🌐 {isEn ? "ES" : "EN"}
            </button>

            <button onClick={() => mostrarVisor ? setMostrarVisor(false) : window.location.reload()} className="btn-exit-luxury">
              {mostrarVisor ? (isEn ? "BACK" : "VOLVER") : (isEn ? "EXIT" : "SALIR")}
            </button>
          </div>
        </div>
      </header>

      <main className="portal-interno-main">
        {!mostrarVisor ? (
          <>
            <div className="welcome-section-luxury">
              <h2 className="gold-text">{isEn ? "WELCOME" : "BIENVENIDO"}</h2>
              <p className="subtitle-luxury">
                {isEn ? (
                  <>
                    Synchronizing studies for <strong>{estudioData?.paciente_nombre || "Patient"}</strong> with the global network...
                  </>
                ) : (
                  <>
                    Sincronizando los estudios de <strong>{estudioData?.paciente_nombre || "Paciente"}</strong> con la red global...
                  </>
                )}
              </p>
            </div>

            <div className="estudios-grid-luxury">
              <div className="estudio-card-luxury" onClick={!loadingEstudio ? activarVisor : null} style={{cursor: 'pointer'}}>
                <div className="card-shine"></div>
                <div className="estudio-icon-gold">🔬</div>
                <div className="estudio-details-luxury">
                  <h4 className="gold-text">{isEn ? "STUDY FOUND" : "ESTUDIO ENCONTRADO"}</h4>
                  <p>
                    {loadingEstudio
                      ? isEn
                        ? "Loading high-resolution images..."
                        : "Cargando imágenes en alta resolución..."
                      : isEn
                      ? "Click to open the image viewer and your report."
                      : "Haga clic para abrir el visor de imágenes y su informe."}
                  </p>
                  
                  {loadingEstudio ? (
                    <div className="loading-bar-gold">
                      <div className="loading-progress"></div>
                    </div>
                  ) : (
                    <div className="tap-to-open gold-text">
                      {isEn ? "CLICK TO OPEN" : "CLIC PARA ABRIR"}
                    </div>
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
                title={isEn ? "View and Download Radiology Report" : "Ver y Descargar Reporte Radiológico"}
              >
                📋<span>{isEn ? "Report" : "Informe"}</span>
              </button>
            </div>
            
            <div className="visor-viewport-luxury">
              <div className="viewport-header-info">
                {isEn ? "PATIENT" : "PACIENTE"}: {estudioData?.paciente_nombre || (isEn ? "UNKNOWN" : "DESCONOCIDO")} | {isEn ? "MODALITY" : "MODALIDAD"}: {estudioData?.modalidad || "N/A"}
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