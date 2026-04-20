import React, { useState } from "react"; 
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Componentes y Páginas
import { Header } from "./components/Header";
import Sidebar from "./components/Sidebar";
import DicomConfigModal from "./components/DicomConfigModal";
import Dashboard from "./components/Dashboard";
import Pacientes from "./Pacientes";
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

// 🔥 PROTECCIÓN MEJORADA: Ahora valida ROLES
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return (
    <div className="global-loading">
      <div className="spinner"></div>
      <p>Validando sesión...</p>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Si se definieron roles permitidos y el usuario no tiene uno de ellos
  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    // Redirección inteligente: si es tecnólogo a su consola, si no al Dashboard
    return user?.rol === "tecnologo" ? <Navigate to="/tecnologo" /> : <Navigate to="/" />;
  }

  return children;
}

function Layout({ children, onOpenDicom }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); 

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
  const { user } = useAuth(); // Obtenemos el usuario para redirecciones iniciales
  const openDicom = () => setShowDicomModal(true);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* 🏠 DASHBOARD: Entran todos menos Tecnólogos */}
        <Route path="/" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['admin', 'superadmin', 'radiologo', 'recepcion']}>
              <Dashboard />
            </ProtectedRoute>
          </Layout>
        } />

        {/* 👥 PACIENTES Y ESTUDIOS */}
        <Route path="/pacientes" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><Pacientes /></ProtectedRoute></Layout>} />
        <Route path="/pacientes/:id/estudios" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><Estudios /></ProtectedRoute></Layout>} />
        <Route path="/imagenes-estudio/:id" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><VisorDICOMWrapper /></ProtectedRoute></Layout>} />
        
        {/* 📱 CONSOLA TÉCNICA (TABLETA): Tecnólogos y SKALO */}
        <Route path="/tecnologo" element={
          <ProtectedRoute allowedRoles={['tecnologo', 'superadmin']}>
            <TecnologoConsole />
          </ProtectedRoute>
        } />

        {/* 🛠️ GESTIÓN DE USUARIOS: SOLO SKALO (SUPERADMIN) */}
        <Route path="/gestion-usuarios" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute allowedRoles={['superadmin']}>
              <GestionUsuarios />
            </ProtectedRoute>
          </Layout>
        } />

        {/* 📊 ESTADÍSTICAS Y PRODUCTIVIDAD: Admin y Superadmin */}
        <Route path="/estadisticas" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin']}><DashboardStats /></ProtectedRoute></Layout>} />
        <Route path="/productividad" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin']}><Productividad /></ProtectedRoute></Layout>} />

        {/* OTRAS RUTAS */}
        <Route path="/configuracion" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><SystemConfig onOpenDicom={openDicom} /></ProtectedRoute></Layout>} />
        <Route path="/config-mapeo" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><ConfigMapeoPage /></ProtectedRoute></Layout>} />
        <Route path="/auditoria" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><AuditoriaPage /></ProtectedRoute></Layout>} />
        <Route path="/recepcion" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin', 'recepcion']}><RecepcionPage /></ProtectedRoute></Layout>} />
        
        {/* LOGS Y EXTRAS */}
        <Route path="/email-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><EmailLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/whatsapp-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['superadmin']}><WhatsAppLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/reporte-cobros" element={<Layout onOpenDicom={openDicom}><ProtectedRoute allowedRoles={['admin', 'superadmin']}><ReporteCobrosPage /></ProtectedRoute></Layout>} />

        <Route path="/logout" element={<Logout />} />
        
        {/* REDIRECCIÓN INTELIGENTE AL ENTRAR A UNA RUTA QUE NO EXISTE */}
        <Route path="*" element={
          user?.rol === 'tecnologo' ? <Navigate to="/tecnologo" replace /> : <Navigate to="/" replace />
        } />
      </Routes>

      <DicomConfigModal isOpen={showDicomModal} onClose={() => setShowDicomModal(false)} />
    </BrowserRouter>
  );
}