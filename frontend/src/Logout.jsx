/**
 * Logout.jsx — MI_PACS (Versión corregida sin bucles infinitos)
 */

import React, { useEffect } from "react";
import { useAuth } from "./AuthContext";

export default function Logout() {
  const { logout } = useAuth();

  useEffect(() => {
    // 1. Limpiamos el contexto y el localStorage
    logout();
    
    // 2. Forzamos redirección total al login. 
    // Esto hace el "refresh" automático que necesitas.
    window.location.href = "/login";
    
    // 👇 AL DEJAR ESTE ARREGLO VACÍO, GARANTIZAMOS QUE SOLO SE EJECUTE UNA VEZ
  }, []); 

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Cerrando sesión de forma segura...</h2>
    </div>
  );
}