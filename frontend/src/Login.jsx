/**
 * Login.jsx — MI_PACS (Versión Definitiva con Línea de Pulso Limpia y Orden Correcto)
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
    <div className="login-page">
      {/* Anillos animados de fondo */}
      <div className="animated-ring-1" />
      <div className="animated-ring-2" />

      {/* Caja del formulario principal */}
      <div className="login-box">
        
        {/* Título y Subtítulo */}
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <h1 className="login-title" style={{ fontSize: "40px" }}>
            MI_PACS
          </h1>
          <p style={{
            fontSize: "0.7rem",
            color: "#94a3b8",
            letterSpacing: "2px",
            textTransform: "uppercase",
            margin: 0,
            fontWeight: "500"
          }}>
            Enterprise Radiology Ecosystem
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text" 
            placeholder="Usuario o Correo clínico"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="login-input"
            required
          />

          {/* Contenedor relativo para la contraseña y el ojo dorado */}
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              style={{ paddingRight: "45px" }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "#fbbf24",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: showPassword ? 1 : 0.7,
                transition: "opacity 0.2s ease"
              }}
              title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 2v2"></path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="login-button" style={{ marginTop: "4px" }}>
            Ingresar al Sistema
          </button>
        </form>

        {/* 💓 Línea de Pulso / EKG limpio de lado a lado */}
        <div className="ecg-container">
          <div className="ecg-line">
            <div className="ecg-pulse-beam" />
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}
      </div>

      {/* Sello institucional inferior dorado */}
      <div style={{
        position: "absolute",
        bottom: "20px",
        zIndex: 10,
        textAlign: "center",
        padding: "8px 16px",
        background: "rgba(17, 20, 24, 0.8)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(251, 191, 36, 0.4)",
        borderRadius: "6px",
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5), 0 0 10px rgba(251, 191, 36, 0.05)"
      }}>
        <p style={{ 
          color: "#d97706", 
          fontSize: "0.7rem", 
          letterSpacing: "1px", 
          margin: "0 0 3px 0", 
          textTransform: "uppercase", 
          fontWeight: "600" 
        }}>
          Seguridad de Grado Hospitalario • Sault Ste. Marie, Ontario
        </p>
        <p style={{ 
          color: "#fbbf24", 
          opacity: 0.9, 
          fontSize: "0.65rem", 
          letterSpacing: "0.5px", 
          margin: 0, 
          fontWeight: "400" 
        }}>
          © 2026 MI_PACS. All Rights Reserved. Developed by Sadat Karim Luna Osorio.
        </p>
      </div>
    </div>
  );
}

export default Login;