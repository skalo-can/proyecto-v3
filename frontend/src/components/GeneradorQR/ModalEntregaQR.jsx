import React from 'react';
import { GeneradorQR } from './GeneradorQR';
import './GeneradorQR.css';

export const ModalEntregaQR = ({ isOpen, onClose, paciente }) => {
  if (!isOpen) return null;

  // 🛠️ LÓGICA DE IMPRESIÓN
  const handlePrint = () => {
    window.print(); // Dispara el diálogo de impresión del navegador
  };

  // 🛠️ LÓGICA DE WHATSAPP
  const handleWhatsApp = () => {
    const ipServidor = "10.0.0.97"; 
    const puerto = "5173";
    const urlParaCelular = `http://${ipServidor}:${puerto}/portal-paciente?id=${paciente.accession}`;
    
    // 🚀 ESTRATEGIA: Enviamos la URL arriba y sola. 
    const mensaje = `${urlParaCelular}\n\n*MI_PACS Global Network*\n\nHola *${paciente.nombre}*, arriba tiene su enlace directo. Copie y pegue en su navegador si no aparece azul.\nID: ${paciente.accession}`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="modal-overlay-luxury">
      <div className="modal-content-luxury">
        <button className="btn-close-modal" onClick={onClose}>×</button>
        
        <div className="modal-header-luxury">
          <h2 className="gold-text">COMPROBANTE DIGITAL</h2>
          <p>MI_PACS GLOBAL NETWORK</p>
        </div>

        <div className="modal-body-luxury">
          {/* 🚀 AJUSTE: Pasamos fecha y modalidad al GeneradorQR */}
          <GeneradorQR 
            accessionNumber={paciente.accession} 
            pacienteNombre={paciente.nombre} 
            fechaExamen={paciente.fecha}     // <-- Nuevo ajuste
            modalidad={paciente.modalidad}   // <-- Nuevo ajuste
          />
          
          <div className="opciones-envio-luxury">
            <button className="btn-action-luxury btn-print-blue" onClick={handlePrint}>
              🖨️ IMPRIMIR TICKET
            </button>
            
            <button className="btn-action-luxury whatsapp" onClick={handleWhatsApp}>
              📱 ENVIAR POR WHATSAPP
            </button>
          </div>
        </div>
        
        <footer className="modal-footer-luxury">
          <p>Recuerde al paciente que su PIN de acceso es su Fecha de Nacimiento.</p>
        </footer>
      </div>
    </div>
  );
};