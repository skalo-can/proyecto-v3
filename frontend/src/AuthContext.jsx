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
  // 🛡️ MOTOR DE SEGURIDAD: CIERRE AUTOMÁTICO ROBUSTO (5 MINUTOS)
  // =========================================================================
  useEffect(() => {
    // Si no hay token activo, no hay necesidad de vigilar
    if (!token) return;

    // Aqui ajustamos los minutos para cerrar la secion
    const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000; 

    // Guardamos la hora de la última interacción como tiempo absoluto
    const actualizarActividad = () => {
      localStorage.setItem("ultimaActividadPacs", Date.now().toString());
    };

    actualizarActividad();

    // { passive: true } evita que la vigilancia ralentice el mouse del médico
    const eventos = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    eventos.forEach(evento => window.addEventListener(evento, actualizarActividad, { passive: true }));

    // Un vigilante independiente revisa el reloj cada 10 segundos
    const intervalId = setInterval(() => {
      const ultimaActividad = parseInt(localStorage.getItem("ultimaActividadPacs") || "0", 10);
      
      if (Date.now() - ultimaActividad > TIEMPO_INACTIVIDAD_MS) {
        console.warn("🔒 Inactividad absoluta detectada. Cerrando sesión...");
        clearInterval(intervalId);
        logout(); 
        alert("🔒 Por seguridad, su sesión se ha cerrado tras 5 minutos de inactividad.");  // esta es la alerta visual de los minutos para que se cierre la secion
      }
    }, 10000);

    return () => {
      clearInterval(intervalId);
      eventos.forEach(evento => window.removeEventListener(evento, actualizarActividad));
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