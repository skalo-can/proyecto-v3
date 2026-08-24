/**
 * Login.jsx — MI_PACS (Versión Definitiva: Órbitas del Logo Ultra Brillantes y Centrado Perfecto)
 */

import React, { useState } from "react"; 
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Login.css"; 

function Login() {
  const [identifier, setIdentifier] = useState(""); 
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }), 
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Credenciales inválidas.");
        return;
      }

      const token = data.token?.access_token || data.access_token || data.token;
      const usuario = data.usuario || data.user;

      if (token && usuario) {
        login(token, usuario);
        
        const rolActual = String(usuario.rol || "").toLowerCase();
        
        if (rolActual === "recepcion" || rolActual === "tecnologo") {
          navigate("/recepcion", { replace: true }); 
        } else {
          navigate("/pacientes", { replace: true });
        }
        
      } else {
        setError("Error en el formato de respuesta del servidor.");
      }

    } catch (err) {
      setError("Error de conexión o respuesta inválida.");
      console.error(err);
    }
  };

  return (
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      background: "radial-gradient(circle at 50% 30%, #111418 0%, #07080a 70%)",
      boxSizing: "border-box",
      overflow: "hidden",
      fontFamily: "'Inter', sans-serif",
      border: "1px solid rgba(251, 191, 36, 0.15)",
      boxShadow: "inset 0 0 100px rgba(251, 191, 36, 0.1), inset 0 0 20px rgba(251, 191, 36, 0.2)"
    }}> 
      
      {/* 🌟 ESTILOS ANIMADOS */}
      <style>{`
        /* Animación suave para el fondo */
        @keyframes pulseGlow {
          0% { transform: scale(1); opacity: 0.2; filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.2)); }
          50% { transform: scale(1.03); opacity: 0.9; filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.6)); }
          100% { transform: scale(1); opacity: 0.2; filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.2)); }
        }
        /* 🌟 NUEVA ANIMACIÓN: Brillo Intenso exclusivo para los aros del logo */
        @keyframes pulseGlowIntense {
          0% { transform: scale(1); opacity: 0.6; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.6)); }
          50% { transform: scale(1.02); opacity: 1; filter: drop-shadow(0 0 30px rgba(251, 191, 36, 1)); }
          100% { transform: scale(1); opacity: 0.6; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.6)); }
        }
        @keyframes rotateLines {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes sweepPulse {
          0% { left: -60%; opacity: 0; }
          25% { opacity: 1; }
          75% { opacity: 1; }
          100% { left: 110%; opacity: 0; }
        }
        @keyframes floatLogo {
          0% { transform: scale(1); filter: drop-shadow(0 15px 30px rgba(0,0,0,0.8)) brightness(1.05) contrast(1.1); }
          50% { transform: scale(1.03) translateY(-10px); filter: drop-shadow(0 20px 40px rgba(251, 191, 36, 0.35)) brightness(1.25) contrast(1.2) saturate(1.3); }
          100% { transform: scale(1); filter: drop-shadow(0 15px 30px rgba(0,0,0,0.8)) brightness(1.05) contrast(1.1); }
        }
      `}</style>

      {/* =====================================================================
          🌌 LAS 8 ÓRBITAS DE FONDO ESTÁTICAS EN LAS ESQUINAS (Suaves)
          ===================================================================== */}
      <div style={{ position: "absolute", top: "-200px", right: "-200px", width: "700px", height: "700px", border: "2px solid rgba(217, 119, 6, 0.6)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 4s ease-in-out infinite, rotateLines 30s linear infinite" }} />
      <div style={{ position: "absolute", top: "-140px", right: "-140px", width: "580px", height: "580px", border: "1.5px solid rgba(251, 191, 36, 0.4)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 3s ease-in-out infinite reverse, rotateLines 20s linear infinite reverse" }} />

      <div style={{ position: "absolute", bottom: "-250px", left: "-250px", width: "900px", height: "900px", border: "2px solid rgba(217, 119, 6, 0.6)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 4.5s ease-in-out infinite reverse, rotateLines 35s linear infinite reverse" }} />
      <div style={{ position: "absolute", bottom: "-200px", left: "-200px", width: "800px", height: "800px", border: "1.5px solid rgba(251, 191, 36, 0.4)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 3.5s ease-in-out infinite, rotateLines 25s linear infinite" }} />

      <div style={{ position: "absolute", top: "-250px", left: "-250px", width: "800px", height: "800px", border: "1.5px solid rgba(217, 119, 6, 0.3)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 5s ease-in-out infinite, rotateLines 40s linear infinite" }} />
      <div style={{ position: "absolute", top: "-180px", left: "-180px", width: "650px", height: "650px", border: "1px solid rgba(251, 191, 36, 0.2)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 4s ease-in-out infinite reverse, rotateLines 30s linear infinite reverse" }} />

      <div style={{ position: "absolute", bottom: "-300px", right: "-300px", width: "950px", height: "950px", border: "2px solid rgba(217, 119, 6, 0.4)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 6s ease-in-out infinite reverse, rotateLines 45s linear infinite reverse" }} />
      <div style={{ position: "absolute", bottom: "-220px", right: "-220px", width: "750px", height: "750px", border: "1.5px solid rgba(251, 191, 36, 0.3)", borderRadius: "50%", pointerEvents: "none", animation: "pulseGlow 5s ease-in-out infinite, rotateLines 35s linear infinite" }} />

      {/* =====================================================================
          📦 CONTENEDOR MAESTRO (Desplazado a la izquierda)
          ===================================================================== */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "-12vw", 
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: "2vw", 
        zIndex: 10
      }}>

        {/* 👁️ BLOQUE 1: LOGO Y SUS ÓRBITAS LOCALES (Ahora con luz intensa) */}
        <div style={{
          position: "relative",
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center",
          width: "450px", 
          height: "450px",
          zIndex: 5
        }}>
          {/* 🌟 Aros del logo: Bordes más gruesos, sombras de neón brillantes y animación "pulseGlowIntense" */}
          <div style={{ position: "absolute", width: "800px", height: "800px", border: "2px solid rgba(251, 191, 36, 0.4)", borderRadius: "50%", boxShadow: "0 0 20px rgba(251, 191, 36, 0.2), inset 0 0 20px rgba(251, 191, 36, 0.2)", pointerEvents: "none", animation: "pulseGlowIntense 5s ease-in-out infinite, rotateLines 40s linear infinite" }} />
          <div style={{ position: "absolute", width: "650px", height: "650px", border: "2px solid rgba(217, 119, 6, 0.6)", borderRadius: "50%", boxShadow: "0 0 25px rgba(217, 119, 6, 0.3), inset 0 0 25px rgba(217, 119, 6, 0.3)", pointerEvents: "none", animation: "pulseGlowIntense 4s ease-in-out infinite reverse, rotateLines 30s linear infinite reverse" }} />
          <div style={{ position: "absolute", width: "500px", height: "500px", border: "2.5px solid rgba(251, 191, 36, 0.5)", borderRadius: "50%", boxShadow: "0 0 30px rgba(251, 191, 36, 0.4), inset 0 0 30px rgba(251, 191, 36, 0.4)", pointerEvents: "none", animation: "pulseGlowIntense 6s ease-in-out infinite, rotateLines 20s linear infinite" }} />

          {/* Logo Vivo */}
          <img 
            src="/logo-simbolo.png" 
            alt="Símbolo MI_PACS" 
            style={{
              position: "relative",
              width: "100%",
              zIndex: 10,
              animation: "floatLogo 6s ease-in-out infinite"
            }}
          />
        </div>


        {/* 🏢 BLOQUE 2: LOGIN, TÍTULOS Y FOOTER CENTRADOS */}
        <div style={{
          height: "100vh", 
          display: "flex", 
          flexDirection: "column",
          justifyContent: "center", 
          alignItems: "center",
          position: "relative",
          zIndex: 10
        }}>

          {/* Tipografía Profesional */}
          <div style={{ textAlign: "center", marginBottom: "25px" }}>
            <h2 style={{ margin: "0 0 8px 0", fontFamily: "'Times New Roman', Times, serif", fontSize: "32px", fontWeight: "400", letterSpacing: "3px", background: "linear-gradient(135deg, #d4af37 30%, #f3e5ab 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              PROFESSIONAL SERVICES
            </h2>
            <p style={{ margin: 0, fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#a3a3a3", letterSpacing: "4px", textTransform: "uppercase" }}>
              MI PACS / VISUALIZATION & LENS FOCUS
            </p>
          </div>

          {/* 📦 Caja Principal de Login */}
          <div style={{
            width: "400px",
            background: "rgba(17, 20, 24, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "38px 32px",
            borderRadius: "16px",
            border: "2px solid rgba(251, 191, 36, 0.5)", 
            boxShadow: "0 30px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(251, 191, 36, 0.15), inset 0 1px 3px rgba(251, 191, 36, 0.3)", 
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxSizing: "border-box"
          }}>
            
            <div style={{ textAlign: "center", marginBottom: "4px" }}>
              <h1 className="login-title" style={{ fontSize: "40px", margin: "0 0 6px 0", background: "linear-gradient(135deg, #ffffff 30%, #fbbf24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase" }}>
                MI_PACS
              </h1>
              <p style={{ fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "2px", textTransform: "uppercase", margin: 0, fontWeight: "500" }}>
                Enterprise Radiology Ecosystem
              </p>
            </div>

            <form onSubmit={handleLogin} className="login-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input type="text" placeholder="Usuario o Correo clínico" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="login-input" required />

              <div style={{ position: "relative", width: "100%" }}>
                <input type={showPassword ? "text" : "password"} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" style={{ paddingRight: "45px", width: "100%" }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#fbbf24", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", opacity: showPassword ? 1 : 0.7, transition: "opacity 0.2s ease" }} title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}>
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2"></path></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  )}
                </button>
              </div>

              <button type="submit" className="login-button" style={{ marginTop: "4px" }}>
                Ingresar al Sistema
              </button>
            </form>

            <div style={{ width: "100%", marginTop: "15px", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", height: "25px", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "2px", background: "rgba(251, 191, 36, 0.2)", position: "relative" }}>
                <div style={{ position: "absolute", top: "50%", left: "-60%", width: "60%", height: "3px", background: "linear-gradient(90deg, transparent, #fbbf24, #ffffff, #fbbf24, transparent)", transform: "translateY(-50%)", filter: "drop-shadow(0 0 8px #fbbf24)", animation: "sweepPulse 2.5s ease-in-out infinite" }} />
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}
          </div>

          {/* 🏷️ Sello Inferior */}
          <div style={{
            position: "absolute", 
            bottom: "20px", 
            textAlign: "center", 
            padding: "10px 18px",
            background: "rgba(17, 20, 24, 0.85)", 
            backdropFilter: "blur(12px)", 
            WebkitBackdropFilter: "blur(12px)",
            border: "1.5px solid rgba(251, 191, 36, 0.4)", 
            borderRadius: "12px",
            boxShadow: "0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(251, 191, 36, 0.15)",
            width: "max-content"
          }}>
            <p style={{ color: "#d97706", fontSize: "0.7rem", letterSpacing: "1px", margin: "0 0 3px 0", textTransform: "uppercase", fontWeight: "600" }}>
              Seguridad de Grado Hospitalario • Sault Ste. Marie, Ontario
            </p>
            <p style={{ color: "#fbbf24", opacity: 0.9, fontSize: "0.65rem", letterSpacing: "0.5px", margin: 0, fontWeight: "400" }}>
              © 2026 MI_PACS. All Rights Reserved. Developed by Sadat Karim Luna Osorio.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Login;