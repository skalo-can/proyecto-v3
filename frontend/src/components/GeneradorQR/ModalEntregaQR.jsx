import React from 'react';
import { useTranslation } from 'react-i18next';
import { GeneradorQR } from './GeneradorQR';
import './GeneradorQR.css';

export const ModalEntregaQR = ({ isOpen, onClose, paciente }) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  if (!isOpen || !paciente) return null;

  // LÓGICA DE IMPRESIÓN
  const handlePrint = () => {
    window.print();
  };

  // LÓGICA DE WHATSAPP PORTABLE (sin IP ni puerto fijo)
  const handleWhatsApp = () => {
    const portalBase =
      import.meta.env.VITE_PUBLIC_URL ||
      window.PUBLIC_URL ||
      window.location.origin;

    const urlParaCelular = `${portalBase}/portal-paciente?id=${encodeURIComponent(paciente.accession || '')}`;

    const mensaje = isEn
      ? `${urlParaCelular}\n\n*MI_PACS Global Network*\n\nHello *${paciente.nombre || ''}*, your direct link is above. Copy and paste it into your browser if it is not clickable.\nID: ${paciente.accession || ''}`
      : `${urlParaCelular}\n\n*MI_PACS Global Network*\n\nHola *${paciente.nombre || ''}*, arriba tiene su enlace directo. Copie y pegue en su navegador si no aparece azul.\nID: ${paciente.accession || ''}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="modal-overlay-luxury">
      <div className="modal-content-luxury">
        <button
          className="btn-close-modal"
          onClick={onClose}
          title={isEn ? 'Close' : 'Cerrar'}
        >
          ×
        </button>

        <div className="modal-header-luxury">
          <h2 className="gold-text">
            {isEn ? 'DIGITAL RECEIPT' : 'COMPROBANTE DIGITAL'}
          </h2>
          <p>MI_PACS GLOBAL NETWORK</p>
        </div>

        <div className="modal-body-luxury">
          <GeneradorQR
            accessionNumber={paciente.accession}
            pacienteNombre={paciente.nombre}
            fechaExamen={paciente.fecha}
            modalidad={paciente.modalidad}
          />

          <div className="opciones-envio-luxury">
            <button className="btn-action-luxury btn-print-blue" onClick={handlePrint}>
              {isEn ? '🖨️ PRINT TICKET' : '🖨️ IMPRIMIR TICKET'}
            </button>

            <button className="btn-action-luxury whatsapp" onClick={handleWhatsApp}>
              {isEn ? '📱 SEND VIA WHATSAPP' : '📱 ENVIAR POR WHATSAPP'}
            </button>
          </div>
        </div>

        <footer className="modal-footer-luxury">
          <p>
            {isEn
              ? 'Remind the patient that their access PIN is their Date of Birth.'
              : 'Recuerde al paciente que su PIN de acceso es su Fecha de Nacimiento.'}
          </p>
        </footer>
      </div>
    </div>
  );
};