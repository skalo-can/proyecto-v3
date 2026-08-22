"""
models/estudio.py — MI_PACS
Modelo SQLAlchemy para estudios clínicos DICOM.
Compatible con:
- Procesador DICOM automático
- Frontend moderno
- API moderna
- Flujo Dual de Urgencias (Fast-Track + Lectura Oficial)
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Date, Enum, ForeignKey, Boolean, DateTime
from datetime import date, datetime

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

    # 🔥 CORRECCIÓN: Cambiado a DateTime para no perder la hora
    fecha_estudio: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        doc="Fecha y hora exacta del estudio (StudyDate + StudyTime)"
    )

    descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Descripción clínica del estudio (StudyDescription)"
    )

    # 🏥 NUEVO: Campo para la institución origen
    institucion: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        default="Desconocida",
        doc="Nombre de la institución de origen (InstitutionName)"
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

    estado_pacs: Mapped[str | None] = mapped_column(
        String(50),
        default="Importado",
        nullable=True,
        doc="Estado persistente del dictado médico (Importado, Dictado, Urgencia, etc.)"
    )

    prioridad_ia: Mapped[str | None] = mapped_column(
        String(50),
        default="NORMAL",
        nullable=True,
        doc="Nivel de prioridad clínica asignado por el motor de IA"
    )

    # ---------------------------------------------------------
    # 🚨 CAMPOS DEL FLUJO DE URGENCIAS (FAST-TRACK)
    # ---------------------------------------------------------
    nota_urgencia: Mapped[str | None] = mapped_column(
        String(2000),
        nullable=True,
        doc="Nota rápida de evidencia ingresada por el médico urgenciólogo"
    )
    
    requiere_lectura_radiologo: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Bandera para evitar el cierre del ciclo hasta que el radiólogo dicte el informe oficial"
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

    # ---------------------------------------------------------
    # 🔥 CAMPOS DE AUDITORÍA Y PRODUCTIVIDAD GERENCIAL
    # ---------------------------------------------------------
    medico_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=True, doc="ID del Médico que firmó"
    )
    transcriptor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=True, doc="ID del Transcriptor que procesó"
    )
    tecnologo_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=True, doc="ID del Tecnólogo que validó/tomó"
    )
    firmado_en: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, doc="Marca de tiempo exacta de la firma"
    )
    fecha_actualizacion: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, doc="Marca de tiempo del último cambio de estado"
    )

    # 🛡️ BANDERAS BOOLEANAS DE SEGURIDAD OPERACIONAL
    tiene_dictado: Mapped[bool] = mapped_column(default=False, nullable=False)
    tiene_transcripcion: Mapped[bool] = mapped_column(default=False, nullable=False)
    esta_firmado: Mapped[bool] = mapped_column(default=False, nullable=False)
    
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

    # Relación con logs de IA
    ia_logs = relationship(
        "EstudioIALog",
        back_populates="estudio",
        cascade="all, delete-orphan",
        doc="Logs generados por los módulos de IA asociados al estudio"
    )
    
    # Relación con reporte
    reporte = relationship(
        "Reporte",
        back_populates="estudio",
        uselist=False,
        cascade="all, delete-orphan",
        doc="Reporte oficial en PDF asociado a este estudio"
    )