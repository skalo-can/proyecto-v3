import React, { useState, useEffect, useCallback } from "react";
import { RecepcionForm } from "../components/RecepcionForm";
import WorklistTable from "../components/WorklistTable";
import axios from "axios";
import "./RecepcionPage.css";

export default function RecepcionPage() {
  const [orders, setOrders] = useState([]);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [dynamicFields, setDynamicFields] = useState([]);

  // 1. Envolvemos fetchData en useCallback para evitar ciclos infinitos con el interval
  const fetchData = useCallback(async () => {
    try {
      // Agregamos t=${Date.now()} para romper el caché y asegurar que la secretaria vea datos reales
      const resWorklist = await axios.get(`http://127.0.0.1:8000/api/ris/worklist?all_active=true&t=${Date.now()}`);
      setOrders(resWorklist.data);

      const resFields = await axios.get("http://127.0.0.1:8000/api/dicom/campos-activos");
      setDynamicFields(resFields.data);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  }, []);

  // 2. EFECTO DE AUTO-REFRESCO: Se ejecuta cada 5 segundos
  useEffect(() => {
    fetchData(); // Carga inicial

    const intervalId = setInterval(() => {
      fetchData();
    }, 5000); // 5 segundos es ideal para Recepción

    return () => clearInterval(intervalId); // Limpieza al cerrar la página
  }, [fetchData]);

  const handleRegisterOrder = async (orderData) => {
    try {
      if (orderToEdit) {
        await axios.put(`http://127.0.0.1:8000/api/ris/order/${orderToEdit.id_orden}`, orderData);
        setOrderToEdit(null);
      } else {
        await axios.post("http://127.0.0.1:8000/api/ris/order", orderData);
      }
      fetchData(); // Refresco instantáneo tras registrar
    } catch (error) {
      console.error("Error en la operación:", error);
      alert("Error al procesar la solicitud.");
    }
  };

  const handleDelete = async (orderId) => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas eliminar esta orden?");
    if (confirmacion) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/ris/order/${orderId}`);
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
      await axios.put(`http://127.0.0.1:8000/api/ris/order/start/${order.id_orden}`);
      await fetchData();
      alert(`✅ Paciente ${order.nombre} enviado a la Worklist (${order.modalidad})`);
    } catch (error) {
      console.error("Error al iniciar:", error);
      alert("No se pudo iniciar la orden.");
    }
  };

  const handleAtenderOrder = async (orderId) => {
    try {
      await axios.put(`http://127.0.0.1:8000/api/ris/order/atender/${orderId}`);
      await fetchData();
      console.log(`✅ Orden ${orderId} marcada como atendida.`);
    } catch (error) {
      console.error("Error al atender la orden:", error);
      alert("No se pudo marcar como atendido.");
    }
  };

  return (
    <div className="recepcion-page-wrapper">
      <div className="recepcion-header-info">
        <h1>Centro de Admisión y Worklist RIS</h1>
        <p>Gestión modular: {orders.length} órdenes activas</p>
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
          />
        </div>
      </div>
    </div>
  );
}