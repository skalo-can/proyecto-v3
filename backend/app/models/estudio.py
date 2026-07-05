"""
models/estudio.py — MI_PACS
Modelo SQLAlchemy para estudios clínicos DICOM.
Compatible con:
- Procesador DICOM automático
- Frontend moderno
- API moderna
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Date, Enum, ForeignKey
from datetime import date

from app.core.database import Base
from app.schemas.estudio import EstadoEstudio

from app.models.reporte import Reporte


class Estudio(Base):
    __tablename__ = "estudios"

    # ID interno del estudio
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
        doc="Identificador interno del estudio"
    )

    # Relación con paciente
    paciente_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pacientes.id"),
        nullable=False,
        index=True,
        doc="ID del paciente asociado"
    )

    paciente = relationship(
        "Paciente",
        back_populates="estudios",
        doc="Paciente al que pertenece el estudio"
    )

    # Metadata clínica del estudio
    tipo_estudio: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Tipo de estudio (Modality DICOM)"
    )

    fecha_estudio: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        doc="Fecha del estudio (StudyDate)"
    )

    descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Descripción clínica del estudio (StudyDescription)"
    )

    # UID del estudio (StudyInstanceUID)
    uid: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        index=True,
        nullable=False,
        doc="UID único del estudio (StudyInstanceUID)"
    )

    # Estado clínico del estudio
    estado: Mapped[EstadoEstudio] = mapped_column(
        Enum(EstadoEstudio),
        nullable=False,
        doc="Estado clínico del estudio (pendiente, procesado, etc.)"
    )

    # 🚀 NUEVO: Campo para persistencia de estado de dictado
    estado_pacs: Mapped[str | None] = mapped_column(
        String(50),
        default="Importado",
        nullable=True,
        doc="Estado persistente del dictado médico (Importado, Dictado, etc.)"
    )

    # ---------------------------------------------------------
    # 📝 CAMPOS DEL FLUJO CLÍNICO (RADIÓLOGO Y TRANSCRIPTOR)
    # ---------------------------------------------------------
    informe_texto: Mapped[str | None] = mapped_column(
        String(5000), 
        nullable=True, 
        doc="Texto completo de la transcripción del diagnóstico"
    )
    
    audio_path: Mapped[str | None] = mapped_column(
        String(255), 
        nullable=True, 
        doc="Ruta local del archivo de audio .wav del dictado"
    )
    
    medico_firma: Mapped[str | None] = mapped_column(
        String(100), 
        nullable=True, 
        doc="Nombre del médico radiólogo que valida el estudio"
    )
    
    registro_medico: Mapped[str | None] = mapped_column(
        String(50), 
        nullable=True, 
        doc="Registro médico (RM) del radiólogo"
    )

    # 🛡️ BANDERAS BOOLEANAS DE SEGURIDAD OPERACIONAL
    tiene_dictado: Mapped[bool] = mapped_column(default=False, nullable=False)
    tiene_transcripcion: Mapped[bool] = mapped_column(default=False, nullable=False)
    esta_firmado: Mapped[bool] = mapped_column(default=False, nullable=False)
    
    # Banderas de entrega (Requeridas por tu paciente_api.py)
    entregado: Mapped[bool] = mapped_column(default=False, nullable=False)
    enviado_sms: Mapped[bool] = mapped_column(default=False, nullable=False)
    enviado_email: Mapped[bool] = mapped_column(default=False, nullable=False)
    enviado_whatsapp: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relación con imágenes
    imagenes = relationship(
        "EstudioImagen",
        back_populates="estudio",
        cascade="all, delete-orphan",
        doc="Lista de imágenes asociadas al estudio"
    )

    # ---------------------------------------------------------
    # RELACIÓN CON LOGS DE IA (CORREGIDA)
    # ---------------------------------------------------------
    ia_logs = relationship(
        "EstudioIALog",   # ← ESTE ERA EL NOMBRE CORRECTO
        back_populates="estudio",
        cascade="all, delete-orphan",
        doc="Logs generados por los módulos de IA asociados al estudio"
    )
    
    # ---------------------------------------------------------
    # RELACIÓN CON EL REPORTE PDF OFICIAL (MÓDULO DE ENTREGA)
    # ---------------------------------------------------------
    reporte = relationship(
        "Reporte",
        back_populates="estudio",
        uselist=False,  # uselist=False le dice a SQLAlchemy que es una relación estricta 1-a-1
        cascade="all, delete-orphan",
        doc="Reporte oficial en PDF asociado a este estudio"
    )