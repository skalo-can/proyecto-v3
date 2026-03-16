import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import DicomConfigModal from "./components/DicomConfigModal";

import Dashboard from "./components/Dashboard";
import Pacientes from "./Pacientes";
import Login from "./Login";
import Logout from "./Logout";
import Estudios from "./Estudios";
import VisorDICOMWrapper from "./VisorDICOMWrapper";
import SystemConfig from "./pages/SystemConfig";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div>Cargando...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function Layout({ children, onOpenDicom }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout-container">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenDicom={onOpenDicom}   // ← 🔥 ESTA ES LA LÍNEA QUE FALTABA
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [showDicomModal, setShowDicomModal] = useState(false);

  return (
    <BrowserRouter>
      <Routes>

        {/* 🔥 LOGIN LIBRE, SIN LAYOUT */}
        <Route path="/login" element={<Login />} />

        {/* 🔥 TODAS LAS DEMÁS RUTAS DENTRO DEL LAYOUT */}
        <Route
          path="/"
          element={
            <Layout onOpenDicom={() => setShowDicomModal(true)}>
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </Layout>
          }
        />

        <Route
          path="/pacientes"
          element={
            <Layout onOpenDicom={() => setShowDicomModal(true)}>
              <ProtectedRoute>
                <Pacientes />
              </ProtectedRoute>
            </Layout>
          }
        />

        <Route
          path="/pacientes/:id/estudios"
          element={
            <Layout onOpenDicom={() => setShowDicomModal(true)}>
              <ProtectedRoute>
                <Estudios />
              </ProtectedRoute>
            </Layout>
          }
        />

        <Route
          path="/imagenes-estudio/:id"
          element={
            <Layout onOpenDicom={() => setShowDicomModal(true)}>
              <ProtectedRoute>
                <VisorDICOMWrapper />
              </ProtectedRoute>
            </Layout>
          }
        />

        <Route
          path="/configuracion"
          element={
            <Layout onOpenDicom={() => setShowDicomModal(true)}>
              <ProtectedRoute>
                <SystemConfig />
              </ProtectedRoute>
            </Layout>
          }
        />

        <Route path="/logout" element={<Logout />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <DicomConfigModal
        isOpen={showDicomModal}
        onClose={() => setShowDicomModal(false)}
      />
    </BrowserRouter>
  );
}