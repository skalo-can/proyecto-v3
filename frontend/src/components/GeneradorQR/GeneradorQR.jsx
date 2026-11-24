import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';

export const GeneradorQR = ({ accessionNumber, pacienteNombre, fechaExamen, modalidad }) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const portalBase =
    import.meta.env.VITE_PUBLIC_URL ||
    window.PUBLIC_URL ||
    window.location.origin;

  const urlPortal = `${portalBase}/portal-paciente?id=${encodeURIComponent(accessionNumber || '')}`;

  // SEGURIDAD: Solo números para la referencia física
  const idSoloNumeros = accessionNumber ? String(accessionNumber).replace('ACC-', '') : '';

  return (
    <div className="qr-container-luxury">
      <div className="qr-card">
        <h3 className="gold-text">
          {isEn ? 'PORTAL ACCESS' : 'ACCESO AL PORTAL'}
        </h3>

        {/* Datos técnicos para la clínica (Seguros y anónimos) */}
        <div className="qr-info-tecnica">
          <span className="info-item">
            <strong>{isEn ? 'Date:' : 'Fecha:'}</strong> {fechaExamen || '---'}
          </span>
          <span className="info-item">
            <strong>Mod:</strong> {modalidad || '---'}
          </span>
        </div>

        <div className="qr-wrapper">
          <QRCodeSVG
            value={urlPortal}
            size={180}
            bgColor={"#000000"}
            fgColor={"#fbbf24"}
            level={"H"}
            includeMargin={true}
          />
        </div>

        <p className="qr-instruction">
          {isEn ? 'Scan to view your results' : 'Escanee para ver sus resultados'}
        </p>

        {/* La "Llave Maestra" numérica */}
        <div className="accession-badge">Ref: {idSoloNumeros}</div>
      </div>
    </div>
  );
};