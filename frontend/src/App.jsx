import React, { useState } from "react"; 
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

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

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="global-loading"><div className="spinner"></div><p>Validando sesión...</p></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
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

  // Función para abrir el modal (compartida por Header y otras vistas)
  const openDicom = () => setShowDicomModal(true);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><Dashboard /></ProtectedRoute></Layout>} />
        <Route path="/pacientes" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><Pacientes /></ProtectedRoute></Layout>} />
        <Route path="/pacientes/:id/estudios" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><Estudios /></ProtectedRoute></Layout>} />
        <Route path="/imagenes-estudio/:id" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><VisorDICOMWrapper /></ProtectedRoute></Layout>} />
        
        {/* CORRECCIÓN AQUÍ: Pasamos openDicom directamente al componente SystemConfig */}
        <Route 
          path="/configuracion" 
          element={
            <Layout onOpenDicom={openDicom}>
              <ProtectedRoute>
                <SystemConfig onOpenDicom={openDicom} />
              </ProtectedRoute>
            </Layout>
          } 
        />
        
        <Route path="/auditoria" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><AuditoriaPage /></ProtectedRoute></Layout>} />
        <Route path="/email-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><EmailLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/secure-links" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><SecureLinksPage /></ProtectedRoute></Layout>} />
        <Route path="/whatsapp-logs" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><WhatsAppLogsPage /></ProtectedRoute></Layout>} />
        <Route path="/estadisticas" element={<Layout onOpenDicom={openDicom}><ProtectedRoute><DashboardStats /></ProtectedRoute></Layout>} />

        <Route path="/reporte-cobros" element={
          <Layout onOpenDicom={openDicom}>
            <ProtectedRoute>
              <ReporteCobrosPage />
            </ProtectedRoute>
          </Layout>
        } />

        <Route path="/logout" element={<Logout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <DicomConfigModal isOpen={showDicomModal} onClose={() => setShowDicomModal(false)} />
    </BrowserRouter>
  );
}