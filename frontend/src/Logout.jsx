/**
- Logout.jsx — MI_PACS (Versión corregida sin bucles infinitos)
 */

import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";

export default function Logout() {
  const { logout } = useAuth();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  useEffect(() => {
    const idiomaActual = localStorage.getItem("i18nextLng") || "";

    // 1. Limpiamos el contexto y el localStorage
    logout();

    // Conservamos el idioma activo para que /login abra en el mismo idioma
    if (idiomaActual) {
      localStorage.setItem("i18nextLng", idiomaActual);
    }

    // 2. Forzamos redirección total al login
    window.location.href = "/login";
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>
        {isEn
          ? "Closing session securely..."
          : "Cerrando sesión de forma segura..."}
      </h2>
    </div>
  );
}