/**
 * Login.jsx — MI_PACS (versión final responsive)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Credenciales inválidas.");
        return;
      }

      login(data.token.access_token);
      localStorage.setItem("rol", data.usuario.rol);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      localStorage.setItem("usuario_id", data.usuario.id);

      navigate("/pacientes", { replace: true });
    } catch (err) {
      setError("No se pudo conectar con el servidor MI_PACS.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">Acceso MI_PACS</h1>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="Correo clínico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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