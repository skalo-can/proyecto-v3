import React from "react";
import { useTranslation } from "react-i18next";

export default function ModalEdicionPaciente({
  isOpen,
  formEdit,
  setFormEdit,
  onCancelar,
  onGuardar
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  if (!isOpen) return null;

  const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 };
  const modalContentExpanded = { background: '#111418', border: '2px solid #fbbf24', borderRadius: '8px', padding: '25px', width: '580px', boxShadow: '0 0 25px rgba(251,191,36,0.3)' };
  const modalTitle = { color: '#fbbf24', margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: 'bold' };
  const modalSubtitle = { color: '#64748b', margin: '0 0 20px 0', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' };
  const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
  const gridFields = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
  const inputGroup = { display: 'flex', flexDirection: 'column', gap: '5px' };
  const labelModal = { color: '#94a3b8', fontSize: '0.65rem', fontWeight: 'bold' };
  const inputModal = { background: '#000', color: '#fff', border: '1px solid #334155', padding: '10px', borderRadius: '4px', fontSize: '0.85rem' };
  const modalActions = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' };
  const btnCancelarModal = { background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };
  const btnGuardarModal = { background: '#fbbf24', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' };

  return (
    <div style={modalOverlay}>
      <div style={modalContentExpanded}>
        <h3 style={modalTitle}>
          {isEn ? "📝 Full PACS Record Modification" : "📝 Modificación Completa de Registro PACS"}
        </h3>
        <p style={modalSubtitle}>{isEn ? "Master Mode" : "Modo Maestro"}</p>
        <form onSubmit={onGuardar} style={formStyle}>
          <div style={gridFields}>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "PATIENT ID / NATIONAL ID" : "CÉDULA / ID PACIENTE"}</label>
              <input type="text" style={inputModal} value={formEdit.identificacion} onChange={(e) => setFormEdit({...formEdit, identificacion: e.target.value})} required />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "DATE OF BIRTH" : "FECHA DE NACIMIENTO"}</label>
              <input type="date" style={inputModal} value={formEdit.fecha_nacimiento} onChange={(e) => setFormEdit({...formEdit, fecha_nacimiento: e.target.value})} required />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "FIRST NAME" : "PRIMER NOMBRE"}</label>
              <input type="text" style={inputModal} value={formEdit.primer_nombre} onChange={(e) => setFormEdit({...formEdit, primer_nombre: e.target.value})} required />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "MIDDLE NAME" : "SEGUNDO NOMBRE"}</label>
              <input type="text" style={inputModal} value={formEdit.segundo_nombre} onChange={(e) => setFormEdit({...formEdit, segundo_nombre: e.target.value})} />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "1ST LAST NAME" : "PRIMER APELLIDO"}</label>
              <input type="text" style={inputModal} value={formEdit.primer_apellido} onChange={(e) => setFormEdit({...formEdit, primer_apellido: e.target.value})} required />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "2ND LAST NAME" : "SEGUNDO APELLIDO"}</label>
              <input type="text" style={inputModal} value={formEdit.segundo_apellido} onChange={(e) => setFormEdit({...formEdit, segundo_apellido: e.target.value})} />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "EMAIL ADDRESS" : "CORREO ELECTRÓNICO (EMAIL)"}</label>
              <input type="email" style={inputModal} value={formEdit.email} onChange={(e) => setFormEdit({...formEdit, email: e.target.value})} />
            </div>
            <div style={inputGroup}>
              <label style={labelModal}>{isEn ? "MOBILE PHONE" : "TELÉFONO MÓVIL"}</label>
              <input
                type="text"
                style={inputModal}
                value={formEdit.telefono}
                placeholder={isEn ? "+15551234567" : "+573001234567"}
                onChange={(e) => setFormEdit({...formEdit, telefono: e.target.value})}
              />
            </div>
          </div>
          <div style={modalActions}>
            <button type="button" onClick={onCancelar} style={btnCancelarModal}>
              {isEn ? "CANCEL" : "CANCELAR"}
            </button>
            <button type="submit" style={btnGuardarModal}>
              {isEn ? "SAVE CHANGES" : "APLICAR EN TABLA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}