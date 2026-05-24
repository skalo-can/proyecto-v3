import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const GeneradorQR = ({ accessionNumber, pacienteNombre, fechaExamen, modalidad }) => {
  const urlPortal = `http://10.0.0.97:5173/portal-paciente?id=${accessionNumber}`;

  // 🛡️ SEGURIDAD: Solo números para la referencia física
  const idSoloNumeros = accessionNumber ? accessionNumber.replace("ACC-", "") : "";

  return (
    <div className="qr-container-luxury">
      <div className="qr-card">
        <h3 className="gold-text">ACCESO AL PORTAL</h3>
        
        {/* Datos técnicos para la clínica (Seguros y anónimos) */}
        <div className="qr-info-tecnica">
          <span className="info-item"><strong>Fecha:</strong> {fechaExamen || '---'}</span>
          <span className="info-item"><strong>Mod:</strong> {modalidad || '---'}</span>
        </div>
        
        <div className="qr-wrapper">
          <QRCodeSVG 
            value={urlPortal}
            size={180} // Ajustado un poco para dar espacio a los nuevos textos
            bgColor={"#000000"}
            fgColor={"#fbbf24"}
            level={"H"}
            includeMargin={true}
          />
        </div>
        
        <p className="qr-instruction">Escanee para ver sus resultados</p>
        
        {/* La "Llave Maestra" numérica */}
        <div className="accession-badge">Ref: {idSoloNumeros}</div>
      </div>
    </div>
  );
};