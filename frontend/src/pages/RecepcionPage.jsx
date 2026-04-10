import React, { useState, useEffect } from "react";
import { RecepcionForm } from "../components/RecepcionForm";
import WorklistTable from "../components/WorklistTable";
import axios from "axios";
import "./RecepcionPage.css";

export default function RecepcionPage() {
  const [orders, setOrders] = useState([]);
  const [orderToEdit, setOrderToEdit] = useState(null);

  // 1. Obtener la lista
  const fetchWorklist = async () => {
    try {
      const response = await axios.get("http://127.0.0.1:8000/api/ris/worklist");
      setOrders(response.data);
    } catch (error) {
      console.error("Error cargando la Worklist:", error);
    }
  };

  useEffect(() => {
    fetchWorklist();
  }, []);

  // 2. Registrar o Actualizar
  const handleRegisterOrder = async (orderData) => {
    try {
      if (orderToEdit) {
        await axios.put(`http://127.0.0.1:8000/api/ris/order/${orderToEdit.id_orden}`, orderData);
        setOrderToEdit(null);
      } else {
        await axios.post("http://127.0.0.1:8000/api/ris/order", orderData);
      }
      fetchWorklist();
    } catch (error) {
      console.error("Error en la operación:", error);
      alert("Error al procesar la solicitud.");
    }
  };

  // 3. Eliminar
  const handleDelete = async (orderId) => {
    const confirmacion = window.confirm("¿Estás seguro de que deseas eliminar esta orden?");
    if (confirmacion) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/ris/order/${orderId}`);
        fetchWorklist();
      } catch (error) {
        alert(error.response?.data?.detail || "No se pudo eliminar.");
      }
    }
  };

  // 4. Preparar Edición
  const handleEditRequest = (order) => {
    setOrderToEdit(order);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔥 5. INICIAR ORDEN (Ahora dentro del componente para que funcione)
  const handleStartOrder = async (order) => {
    try {
      // Llamada al endpoint que cambia el estado a 'Iniciado'
      await axios.put(`http://127.0.0.1:8000/api/ris/order/start/${order.id_orden}`);
      
      // Actualizamos la tabla inmediatamente
      await fetchWorklist();
      
      alert(`✅ Paciente ${order.nombre} enviado a la Worklist (${order.modalidad})`);
    } catch (error) {
      console.error("Error al iniciar:", error);
      alert("No se pudo iniciar la orden. Verifica la conexión con el servidor.");
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
          />
        </div>

        <div className="layout-section-list">
          <div className="list-card-header">
            <h3><i className="fas fa-list"></i> Pacientes en Espera Hoy</h3>
            <button onClick={fetchWorklist} className="btn-refresh">
              <i className="fas fa-sync"></i>
            </button>
          </div>
          <WorklistTable 
            orders={orders} 
            onDelete={handleDelete}
            onEdit={handleEditRequest}
            onStart={handleStartOrder} /* <-- Conectado correctamente */
          />
        </div>
      </div>
    </div>
  );
}