import React, { useState } from "react";
import { FaEdit, FaTrash, FaCheckCircle, FaQrcode } from "react-icons/fa"; // 🚀 Importamos el icono de QR
import "./WorklistTable.css";

// 🚀 Añadimos onShowQR a las props recibidas
const WorklistTable = ({ orders, onDelete, onEdit, onStart, onAtender, onShowQR }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrders, setSelectedOrders] = useState([]);

  const toggleSelect = (id) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 🔥 LÓGICA ACTUALIZADA: Filtramos y luego invertimos el orden (.reverse())
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.nombre.toLowerCase().includes(searchLower) ||
      order.apellido.toLowerCase().includes(searchLower) ||
      order.id_institucional.includes(searchLower) ||
      order.accession_number.toLowerCase().includes(searchLower)
    );
  }).reverse(); // <--- Los últimos ingresos ahora aparecen primero

  return (
    <div className="worklist-wrapper-fused">
      <div className="worklist-search-container">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, ID o Acc. Number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input-ris"
        />
        <div className="search-info-bar">
          <h3>Pacientes en Espera</h3>
          <span className="results-pill">
            {filteredOrders.length} {filteredOrders.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      <div className="worklist-table-container">
        <table className="worklist-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) setSelectedOrders(filteredOrders.map(o => o.id_orden));
                    else setSelectedOrders([]);
                  }}
                  checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                />
              </th>
              <th>Paciente</th>
              <th>ID</th>
              <th>Modalidad</th>
              <th>Acc. Number</th>
              <th>Prioridad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const isSelected = selectedOrders.includes(order.id_orden);
                return (
                  <tr key={order.id_orden} className={`worklist-row animate-in ${isSelected ? "row-selected" : ""}`}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleSelect(order.id_orden)} 
                        className="custom-checkbox"
                      />
                    </td>
                    <td><strong>{`${order.nombre} ${order.apellido}`}</strong></td>
                    <td>{order.id_institucional}</td>
                    <td><span className="badge-modalidad">{order.modalidad}</span></td>
                    <td><code className="acc-code">{order.accession_number}</code></td>
                    <td>
                      <span className={`priority-tag ${order.prioridad.toLowerCase()}`}>
                        {order.prioridad}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {/* 🚀 BOTÓN DE QR (ESTILO DORADO) */}
                      <button 
                        className="btn-icon qr-gold" 
                        onClick={() => onShowQR(order)} 
                        title="Generar QR de Acceso"
                        style={{ color: '#fbbf24', fontSize: '1.1rem', marginRight: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        <FaQrcode />
                      </button>

                      <button className="btn-icon edit" onClick={() => onEdit(order)} title="Editar"><FaEdit /></button>
                      <button className="btn-icon delete" onClick={() => onDelete(order.id_orden)} title="Eliminar"><FaTrash /></button>

                      {order.estado_ris === "En Espera" ? (
                        <button className="btn-action-start" onClick={() => onStart(order)}>Iniciar</button>
                      ) : order.estado_ris === "Iniciado" ? (
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <span className="badge-iniciado"><i className="fas fa-check-circle"></i> En Worklist</span>
                          <button 
                            className="btn-action-atender" 
                            onClick={() => onAtender(order.id_orden)} 
                            style={{ 
                              backgroundColor: '#28a745', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              padding: '5px 8px', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                          >
                            <FaCheckCircle /> Atender
                          </button>
                        </div>
                      ) : (
                        <span className="badge-atendido" style={{ color: '#888', fontStyle: 'italic' }}>✓ Atendido</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="no-results">No hay pacientes en la lista.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorklistTable;