/**
 * Componente clínico de cierre de sesión.
 *
 * Este módulo realiza una limpieza controlada de credenciales clínicas
 * almacenadas en el navegador y redirige al usuario hacia la pantalla
 * de autenticación. Forma parte del flujo de seguridad de MI_PACS.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";   // ← 🔥 IMPORTANTE

function Logout() {
  const navigate = useNavigate();
  const { logout } = useAuth();            // ← 🔥 LLAMAMOS AL CONTEXTO

  useEffect(() => {
    // --- Limpieza clínica de sesión ---
    logout();  // ← limpia el token del contexto

    // Eliminación explícita de claves adicionales
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("usuario_id");
    localStorage.removeItem("rol");

    // Limpieza opcional de artefactos temporales
    sessionStorage.clear();

    // --- Redirección inmediata al login ---
    navigate("/login", { replace: true });
  }, [logout, navigate]);
  
  return null;
}

export default Logout;