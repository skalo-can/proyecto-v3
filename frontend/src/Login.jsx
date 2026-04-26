/**
 * Login.jsx — MI_PACS (Versión compatible con SKALO)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./login.css";

function Login() {
  const [identifier, setIdentifier] = useState(""); // Cambiado de email a identifier
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // const response = await fetch("http://127.0.0.1:8000/api/auth/login", {
      // A ESTO (La IP de su PC):
      const response = await fetch("http://10.0.0.97:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }), 
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Credenciales inválidas.");
        return;
      }

      // --- CORRECCIÓN AQUÍ ---
      // El backend envía el token directamente o dentro de un objeto. 
      // Según tus logs, el login fue exitoso (200 OK).
      const token = data.token?.access_token || data.access_token || data.token;
      const usuario = data.usuario || data.user;

      if (token && usuario) {
        login(token, usuario);
        navigate("/pacientes", { replace: true });
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
      <div className="login-box">
        <h1 className="login-title">Acceso MI_PACS</h1>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text" // <-- CAMBIADO A TEXT para permitir "SKALO"
            placeholder="Usuario o Correo clínico"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="login-input"
            required
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />

          <button type="submit" className="login-button">
            Ingresar
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}

export default Login;