import React, { useState } from "react";
import { useParams } from "react-router-dom"; // 🚀 Fundamental para leer el token
import { useAuth } from "../../AuthContext";
import "./PortalPaciente.css";

import VisorDICOMWrapper from "../../VisorDICOMWrapper";

export const PortalPaciente = () => {
  const { token } = useParams(); // 🚀 Extraemos el token de la URL automáticamente
  const { user } = useAuth();
  
  const [validado, setValidado] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [validandoPin, setValidandoPin] = useState(false); // Para el efecto de carga del botón
  const [estudioData, setEstudioData] = useState(null); // Aquí guardaremos los datos reales
  
  // Estados para controlar la transición al visor
  const [loadingEstudio, setLoadingEstudio] = useState(false);
  const [mostrarVisor, setMostrarVisor] = useState(false);

  // 🔥 Conexión real con el backend
  const handleAcceso = async () => {
    if (!pin || pin.length < 4) return;
    
    setValidandoPin(true);
    setError(false);

    try {
      const apiBase = window.location.origin;
      
      const response = await fetch(`${apiBase}/api/secure-links/validar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, pin: pin })
      });

      if (!response.ok) {
        throw new Error("Identidad no verificada");
      }

      const data = await response.json();
      
      if (data.acceso_permitido) {
        setEstudioData(data.estudio); // Guardamos "Edison Correa", ID, Modalidad, etc.
        setValidado(true);
        setPin("");
      }
    } catch (err) {
      console.error(err);
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 2000); // El botón tiembla por 2 segundos
    } finally {
      setValidandoPin(false);
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

  // Función para abrir el PDF en una pestaña nueva usando el token seguro
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
          <input 
            type="password" 
            placeholder="PIN DE ACCESO" 
            value={pin}
            autoComplete="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
            maxLength={8}
            className="portal-input-pin"
            disabled={validandoPin}
          />
          {error && <p className="error-text">⚠️ IDENTIDAD NO VERIFICADA</p>}
          <button 
            onClick={handleAcceso} 
            className="btn-portal-confirmar"
            disabled={validandoPin || pin.length === 0}
          >
            {validandoPin ? "VERIFICANDO..." : "VERIFICAR IDENTIDAD"}
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
          /* 🖼️ VISOR CINEMATOGRÁFICO DE PACIENTE */
          <div className="visor-paciente-main">
            <div className="visor-sidebar-gold">
              {/* Botones decorativos eliminados para evitar confusiones */}
              <button 
                className="tool-gold-btn highlight" 
                onClick={abrirInforme}
                title="Ver y Descargar Reporte Radiológico"
              >
                📋<span>Informe</span>
              </button>
            </div>
            
            <div className="visor-viewport-luxury">
              {/* Mostramos datos reales traídos del backend */}
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