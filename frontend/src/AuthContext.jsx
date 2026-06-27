import React, { createContext, useContext, useState, useEffect } from "react"; // 👈 ¡Inyectado 'React,' al inicio!

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState({ username: "", rol: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch (e) { setUser({ username: "", rol: "" }); }
    }
    setLoading(false);
  }, []);

  const login = (newToken, userData) => {
    const normalizedUser = { 
      ...userData, 
      username: userData.nombre || userData.email,
      rol: userData.rol // Nos aseguramos de capturar el rol del backend
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
    setUser({ username: "", rol: "" });
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }