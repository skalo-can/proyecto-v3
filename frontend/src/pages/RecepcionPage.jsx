import React, { useState, useEffect, useCallback } from "react";
import { RecepcionForm } from "../components/RecepcionForm";
import WorklistTable from "../components/WorklistTable";
import axios from "axios";
import "./RecepcionPage.css";

// 🚀 IMPORTAMOS EL MODAL DE ENTREGA QR
import { ModalEntregaQR } from "../components/GeneradorQR/ModalEntregaQR";

export default function RecepcionPage() {
  const [orders, setOrders] = useState([]);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [dynamicFields, setDynamicFields] = useState([]);

  // 🚀 ESTADO CORREGIDO (Sin la 'l' extra para evitar errores)
  const [modalQRAbierto, setModalQRAbierto] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const resWorklist = await axios.get(`http://192.168.5.21:8000/api/ris/worklist?all_active=true&t=${Date.now()}`);
      setOrders(resWorklist.data);

      const resFields = await axios.get("http://192.168.5.21:8000/api/dicom/campos-activos");
      setDynamicFields(resFields.data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData();
    }, 5000); 
    return () => clearInterval(intervalId); 
  }, [fetchData]);

  const handleRegisterOrder = async (orderData) => {
    try {
      if (orderToEdit) {
        await axios.put(`http://192.168.5.21:8000/api/ris/order/${orderToEdit.id_orden}`, orderData);
        setOrderToEdit(null);
      } else {
        await axios.post("http://192.168.5.21:8000/api/ris/order", orderData);
      }
      fetchData(); 
    } catch (error) {
      console.error("Error en la operación:", error);
      alert("Error al procesar la solicitud.");
    }
  };

  const handleDelete = async (orderId) => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas eliminar esta orden?");
    if (confirmacion) {
      try {
        await axios.delete(`http://192.168.5.21:8000/api/ris/order/${orderId}`);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.detail || "No se pudo eliminar.");
      }
    }
  };

  const handleEditRequest = (order) => {
    setOrderToEdit(order);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartOrder = async (order) => {
    try {
      await axios.put(`http://192.168.5.21:8000/api/ris/order/start/${order.id_orden}`);
      await fetchData();
      alert(`✅ Paciente ${order.nombre} enviado a la Worklist (${order.modalidad})`);
    } catch (error) {
      console.error("Error al iniciar:", error);
      alert("No se pudo iniciar la orden.");
    }
  };

  const handleAtenderOrder = async (orderId) => {
    try {
      await axios.put(`http://192.168.5.21:8000/api/ris/order/atender/${orderId}`);
      await fetchData();
    } catch (error) {
      console.error("Error al atender la orden:", error);
    }
  };

  const handleMostrarQR = (order) => {
    setPacienteSeleccionado({
      nombre: order.nombre,
      accession: order.accession_number || order.id_orden 
    });
    setModalQRAbierto(true);
  };

  const handleResetVista = () => {
    setOrderToEdit(null);
    setModalQRAbierto(false);
    fetchData();
  };

  return (
    <div className="recepcion-page-wrapper">
      <div className="recepcion-header-info">
        <div className="header-flex-container">
            <div>
                <h1>Centro de Admisión y Worklist RIS</h1>
                <p>Gestión modular: {orders.length} órdenes activas</p>
            </div>
            {/* 🚀 BOTÓN CON CONDICIÓN CORREGIDA */}
            {(orderToEdit || modalQRAbierto) && (
                <button onClick={handleResetVista} className="btn-back-to-list-v2">
                    <i className="fas fa-undo"></i> VOLVER A LA LISTA
                </button>
            )}
        </div>
      </div>

      <div className="recepcion-layout-split">
        <div className="layout-section-form">
          <RecepcionForm 
            onRegisterOrder={handleRegisterOrder} 
            initialData={orderToEdit} 
            onCancel={() => setOrderToEdit(null)}
            dynamicFields={dynamicFields} 
          />
        </div>

        <div className="layout-section-list">
          <div className="list-card-header">
            <h3><i className="fas fa-list"></i> Pacientes en Espera Hoy</h3>
            <button onClick={fetchData} className="btn-refresh">
              <i className="fas fa-sync"></i>
            </button>
          </div>
          <WorklistTable 
            orders={orders} 
            onDelete={handleDelete}
            onEdit={handleEditRequest}
            onStart={handleStartOrder} 
            onAtender={handleAtenderOrder}
            onShowQR={handleMostrarQR} 
          />
        </div>
      </div>

      {/* 🚀 PROP CORREGIDA AQUÍ TAMBIÉN */}
      <ModalEntregaQR 
        isOpen={modalQRAbierto} 
        onClose={() => setModalQRAbierto(false)} 
        paciente={pacienteSeleccionado} 
      />
    </div>
  );
}