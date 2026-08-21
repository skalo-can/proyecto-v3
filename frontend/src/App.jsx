import React, { useState } from "react"; 
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import axios from "axios"; // 🚀 IMPORTACIÓN AÑADIDA PARA EL INTERCEPTOR

// =====================================================================
// 🛡️ ESCUDO INTERCEPTOR GLOBAL DE SEGURIDAD
// =====================================================================
// Si cualquier pantalla (como el temporizador de importación) recibe un 
// error 401 (No Autorizado), este escudo detiene la petición, borra el 
// rastro de la sesión y manda al usuario al Login automáticamente.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("🔒 Seguridad: Sesión inválida o expirada. Redirigiendo al Login...");
      localStorage.removeItem("token");
      
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
// =====================================================================

// Componentes y Páginas
import { Header } from "./components/Header";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Pacientes from "./pages/pacientes";
import Login from "./Login";
import Logout from "./Logout";
import Estudios from "./Estudios";
import VisorDICOMWrapper from "./VisorDICOMWrapper";
import SystemConfig from "./pages/SystemConfig";
import AuditoriaPage from "./pages/AuditoriaPage";
import EmailLogsPage from "./pages/EmailLogsPage";
import SecureLinksPage from "./pages/SecureLinksPage";
import WhatsAppLogsPage from "./pages/WhatsAppLogsPage";
import DashboardStats from "./pages/DashboardStats";
import FacturacionServicio from "./pages/FacturacionServicio";
import RecepcionPage from "./pages/RecepcionPage";
import ConfigMapeoPage from './pages/ConfigMapeoPage';
import Productividad from "./pages/Productividad";
import TecnologoConsole from "./pages/TecnologoConsole";
import GestionUsuarios from "./pages/GestionUsuarios";
import BackupConfigPage from "./pages/BackupConfigPage";
import RecuperarBackupsPage from './pages/RecuperarBackupsPage.jsx';
import { PortalPaciente } from "./components/PortalPaciente/PortalPaciente";
import ImportarPage from './pages/ImportarPage';
import ExportarPage from './pages/ExportarPage';
import PerfilInstitucion from "./components/PerfilInstitucion";
import GestorPlantillas from "./components/GestorPlantillas";
import GestorFirmas from "./pages/GestorFirmas";

// 🚀 IMPORTACIONES PARA MÓDULOS MULTIMONITOR
import ModalDictadoHardware from "./pages/ModalDictadoHardware";
import ModalTranscriptor from "./components/Modals/ModalTranscriptor";
import ModalFirma from "./components/Modals/ModalFirma";

// =====================================================================
// 🌍 DETECTOR AUTOMÁTICO DE ENTORNO (HOSPITAL-GRADE)
// =====================================================================
let apiUrl = "http://192.168.5.21:8000"; // Por defecto, asume que no hay internet (Intranet)

// Si la URL del navegador contiene el dominio público, cambia la ruta hacia internet
if (window.location.hostname.includes("portal.mipacs.net")) {
  apiUrl = "https://portal.mipacs.net";
}

// Hacemos que esta variable esté disponible en todo el sistema
window.API_URL = apiUrl;
// =====================================================================

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return (
    <div className="global-loading">
      <div className="spinner"></div>
      <p>Validando sesión...</p>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const userRolRaw = String(user?.rol || "").toLowerCase().trim();
  
  let userRolNormalizado = userRolRaw;
  if (userRolRaw.startsWith("medico")) {
    userRolNormalizado = "radiologo";
  }

  if (allowedRoles && !allowedRoles.includes(userRolNormalizado)) {
    return userRolNormalizado === "tecnologo" ? <Navigate to="/tecnologo" replace /> : <Navigate to="/" replace />;
  }

  return children;
}

function Layout({ children, onOpenDicom }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const { user, loading } = useAuth(); 

  if (loading) {
    return <div style={{ background: '#000', height: '100vh', width: '100vw' }} />;
  }

  if (user?.rol === 'paciente') {
    return (
      <main style={{ background: '#000', minHeight: '100vh', width: '100vw', position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    );
  }

  return (
    <div className="layout-container" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Header  
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onOpenDicom={onOpenDicom} 
      />
      <div className="layout-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="layout-content" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [showDicomModal, setShowDicomModal] = useState(false);
  const { user, isAuthenticated, loading } = useAuth(); 
  const openDicom = () => setShowDicomModal(true);

  if (loading) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          isAuthenticated && user?.rol === 'paciente' ? (
            <Navigate to="/portal-paciente" replace />
          ) : (
            <Layout onOpenDicom={openDicom}>
              <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado', 'transcriptor', 'it_biomedica']}>
                <Dashboard />
              </ProtectedRoute>
            </Layout>
          )
        } />

        {/* ========================================================
            🚀 RUTAS LIMPIAS (MULTIMONITOR)
            SIN Layout, para abrir en ventanas flotantes nativas.
           ======================================================== */}

        <Route path="/visor-dictado/:pacienteId" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'invitado']}>
            <ModalDictadoHardware isOpen={true} isWindow={true} />
          </ProtectedRoute>
        } />

        <Route path="/visor-transcriptor/:estudioId" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'auxiliar', 'invitado', 'transcriptor']}>
            <ModalTranscriptor visible={true} isWindow={true} />
          </ProtectedRoute>
        } />

        <Route path="/visor-firma/:estudioId" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'invitado']}>
            <ModalFirma visible={true} isWindow={true} />
          </ProtectedRoute>
        } />

        {/* 🔥 NUEVO: Visor DICOM trasladado a Ruta Limpia */}
        <Route path="/imagenes-estudio/:id" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'auxiliar', 'invitado', 'transcriptor', 'tecnologo', 'it_biomedica']}>
            <VisorDICOMWrapper />
          </ProtectedRoute>
        } />

        {/* ======================================================== */}

        <Route path="/pacientes" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado', 'transcriptor', 'tecnologo', 'it_biomedica']}><Pacientes /></ProtectedRoute></Layout>} />
        <Route path="/pacientes/:id/estudios" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado', 'transcriptor', 'tecnologo', 'it_biomedica']}><Estudios /></ProtectedRoute></Layout>} />
        
        <Route path="/tecnologo" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['tecnologo', 'superadmin', 'recepcion']}><TecnologoConsole /></ProtectedRoute></Layout>} />
        <Route path="/gestion-usuarios" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><GestionUsuarios /></ProtectedRoute></Layout>} />
        
        <Route path="/plantillas" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'transcriptor']}>
              <GestorPlantillas />
            </ProtectedRoute>
          </Layout>
        } />

        <Route path="/gestion-firmas" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['superadmin', 'admin', 'radiologo']}>
              <GestorFirmas />
            </ProtectedRoute>
          </Layout>
        } />

        <Route path="/estadisticas" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'invitado']}><DashboardStats /></ProtectedRoute></Layout>} />
        <Route path="/productividad" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'invitado']}><Productividad /></ProtectedRoute></Layout>} />
        <Route path="/importar" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin']}><ImportarPage /></ProtectedRoute></Layout>} />
        <Route path="/exportar" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin']}><ExportarPage /></ProtectedRoute></Layout>} />
        <Route path="/config-mapeo" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><ConfigMapeoPage /></ProtectedRoute></Layout>} />
        <Route path="/auditoria" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><AuditoriaPage /></ProtectedRoute></Layout>} />
        <Route path="/recepcion" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'recepcion']}><RecepcionPage /></ProtectedRoute></Layout>} />
        <Route path="/gestion-backups" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><BackupConfigPage /></ProtectedRoute></Layout>} />
        <Route path="/recuperar-backups" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><RecuperarBackupsPage /></ProtectedRoute></Layout>} />
        {/* 🔥 PORTAL EXTERNO PARA PACIENTES (Aislamiento Total) */}
        <Route path="/portal/:token" element={<PortalPaciente />} />
        <Route path="/email-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><EmailLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/whatsapp-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><WhatsAppLogsPage /></ProtectedRoute></Layout>} />
        
        <Route path="/facturacion-servicio" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'auxiliar']}><FacturacionServicio /></ProtectedRoute></Layout>} />
        
        <Route path="/perfil-institucion" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['superadmin']}>
              <PerfilInstitucion />
            </ProtectedRoute>
          </Layout>
        } />

        <Route path="/logout" element={<Logout />} />
        
        <Route path="*" element={
          user?.rol === 'tecnologo' ? <Navigate to="/tecnologo" replace /> : 
          user?.rol === 'paciente' ? <Navigate to="/portal-paciente" replace /> :
          <Navigate to="/" replace />
        } />
      </Routes>
    </BrowserRouter>
  );
} 