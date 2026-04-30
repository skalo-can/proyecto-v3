import React, { useState } from "react"; 
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Componentes y Páginas
import { Header } from "./components/Header";
import Sidebar from "./components/Sidebar";
import DicomConfigModal from "./components/DicomConfigModal";
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
import ReporteCobrosPage from "./pages/ReporteCobrosPage";
import RecepcionPage from "./pages/RecepcionPage";
import ConfigMapeoPage from './pages/ConfigMapeoPage';
import Productividad from "./pages/Productividad";
import TecnologoConsole from "./pages/TecnologoConsole";
import GestionUsuarios from "./pages/GestionUsuarios";

// 🚀 IMPORTAMOS SU NUEVO PORTAL
import { PortalPaciente } from "./components/PortalPaciente/PortalPaciente";

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return (
    <div className="global-loading">
      <div className="spinner"></div>
      <p>Validando sesión...</p>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    return user?.rol === "tecnologo" ? <Navigate to="/tecnologo" /> : <Navigate to="/" />;
  }

  return children;
}

// 🔥 LAYOUT INTELIGENTE: Eliminamos el flasheo con una validación de 'loading'
function Layout({ children, onOpenDicom }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const { user, loading } = useAuth(); 

  if (loading) {
    return <div style={{ background: '#000', height: '100vh', width: '100vw' }} />;
  }

  if (user?.rol === 'paciente') {
    return (
      <main style={{ 
        background: '#000', 
        minHeight: '100vh', 
        width: '100vw', 
        position: 'relative', 
        zIndex: 1 
      }}>
        {children}
      </main>
    );
  }

  return (
    <div className="layout-container">
      <Header 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onOpenDicom={onOpenDicom} 
      />
      <div className="layout-body">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [showDicomModal, setShowDicomModal] = useState(false);
  const { user, isAuthenticated, loading } = useAuth(); // Agregamos isAuthenticated y loading
  const openDicom = () => setShowDicomModal(true);

  if (loading) return <div style={{ background: '#000', height: '100vh' }} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* 🏠 RUTA RAÍZ CON REDIRECCIÓN MAESTRA PARA PACIENTES */}
        <Route path="/" element={
          isAuthenticated && user?.rol === 'paciente' ? (
            <Navigate to="/portal-paciente" replace />
          ) : (
            <Layout onOpenDicom={openDicom}>
              <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado']}>
                <Dashboard />
              </ProtectedRoute>
            </Layout>
          )
        } />

        {/* 👥 PACIENTES Y ESTUDIOS */}
        <Route path="/pacientes" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado']}><Pacientes /></ProtectedRoute></Layout>} />
        <Route path="/pacientes/:id/estudios" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion', 'auxiliar', 'invitado']}><Estudios /></ProtectedRoute></Layout>} />
        <Route path="/imagenes-estudio/:id" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'auxiliar', 'invitado']}><VisorDICOMWrapper /></ProtectedRoute></Layout>} />
        
        {/* 📱 CONSOLA TÉCNICA */}
        <Route path="/tecnologo" element={
          <ProtectedRoute allowedRoles={['tecnologo', 'superadmin']}>
            <TecnologoConsole />
          </ProtectedRoute>
        } />

        {/* 🛠️ GESTIÓN DE USUARIOS */}
        <Route path="/gestion-usuarios" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['superadmin']}>
              <GestionUsuarios />
            </ProtectedRoute>
          </Layout>
        } />

        {/* 📊 ESTADÍSTICAS Y PRODUCTIVIDAD */}
        <Route path="/estadisticas" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'invitado']}><DashboardStats /></ProtectedRoute></Layout>} />
        <Route path="/productividad" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'invitado']}><Productividad /></ProtectedRoute></Layout>} />

        {/* OTRAS RUTAS */}
        <Route path="/configuracion" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><SystemConfig onOpenDicom={openDicom} /></ProtectedRoute></Layout>} />
        <Route path="/config-mapeo" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><ConfigMapeoPage /></ProtectedRoute></Layout>} />
        <Route path="/auditoria" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><AuditoriaPage /></ProtectedRoute></Layout>} />
        <Route path="/recepcion" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'recepcion']}><RecepcionPage /></ProtectedRoute></Layout>} />
        
        {/* 🔐 PORTAL PACIENTE */}
        <Route path="/portal-paciente" element={
          <Layout>
            <ProtectedRoute allowedRoles={['paciente']}>
              <PortalPaciente />
            </ProtectedRoute>
          </Layout>
        } />

        {/* LOGS Y EXTRAS */}
        <Route path="/email-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><EmailLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/whatsapp-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><WhatsAppLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/reporte-cobros" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'auxiliar']}><ReporteCobrosPage /></ProtectedRoute></Layout>} />

        <Route path="/logout" element={<Logout />} />
        
        {/* REDIRECCIÓN INTELIGENTE FINAL */}
        <Route path="*" element={
          user?.rol === 'tecnologo' ? <Navigate to="/tecnologo" replace /> : 
          user?.rol === 'paciente' ? <Navigate to="/portal-paciente" replace /> :
          <Navigate to="/" replace />
        } />
      </Routes>

      <DicomConfigModal isOpen={showDicomModal} onClose={() => setShowDicomModal(false)} />
    </BrowserRouter>
  );
}