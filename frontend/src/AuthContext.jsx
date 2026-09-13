import React, { createContext, useContext, useState, useEffect, useRef } from "react"; 

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState({ username: "", rol: "", permisos: {} }); 
  const [loading, setLoading] = useState(true);
  
  // Referencia para el temporizador de inactividad
  const timeoutRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { 
        setUser(JSON.parse(savedUser)); 
      } catch (e) { 
        setUser({ username: "", rol: "", permisos: {} }); 
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken, userData) => {
    const normalizedUser = { 
      ...userData, 
      username: userData.nombre || userData.email,
      rol: userData.rol,
      permisos: userData.permisos || {} 
    };
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    setToken(newToken);
    setUser(normalizedUser);
  };

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setUser({ username: "", rol: "", permisos: {} });
  };

  // =========================================================================
  // 🛡️ MOTOR DE SEGURIDAD: CIERRE AUTOMÁTICO POR INACTIVIDAD (5 MINUTOS)
  // =========================================================================
  useEffect(() => {
    // Si no hay token activo, no iniciamos el rastreo de inactividad
    if (!token) return;

    const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000; 

    const cerrarSesionPorInactividad = () => {
      console.warn("🔒 Inactividad detectada. Cerrando sesión...");
      logout(); 
      alert("🔒 Por seguridad, su sesión se ha cerrado tras 5 minutos de inactividad.");
      window.location.href = "/login"; 
    };

    const reiniciarTemporizador = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(cerrarSesionPorInactividad, TIEMPO_INACTIVIDAD_MS);
    };

    const eventosActividad = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    reiniciarTemporizador();

    eventosActividad.forEach(evento => {
      window.addEventListener(evento, reiniciarTemporizador);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      eventosActividad.forEach(evento => {
        window.removeEventListener(evento, reiniciarTemporizador);
      });
    };
  }, [token]); 
  // =========================================================================

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }