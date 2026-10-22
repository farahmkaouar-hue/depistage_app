import enum
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base
def enum_values(enum_class):
    return [member.value for member in enum_class]

class Role(str, enum.Enum):
    medecin = "medecin"
    preleveur = "preleveur"
    direction = "direction"


class PatientStatus(str, enum.Enum):
    form_progress = "form-progress"
    tdr_pending = "tdr-pending"
    positive_alert = "positive-alert"
    oriented = "oriented"
    closed = "closed"


class TestResult(str, enum.Enum):
    positif = "positif"
    negatif = "negatif"
    douteux = "douteux"


class PcrResult(str, enum.Enum):
    detectable = "detectable"
    indetectable = "indetectable"


class OrientationStatus(str, enum.Enum):
    sent = "sent"
    confirmed = "confirmed"
    refused = "refused"


class TaskType(str, enum.Enum):
    screening = "screening"
    pcr = "pcr"
    orientation = "orientation"
    recontact = "recontact"


class TaskStatus(str, enum.Enum):
    open = "open"
    done = "done"
    cancelled = "cancelled"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role, name="role", values_callable=enum_values))
    facility: Mapped[str | None] = mapped_column(String(200))
    governorate: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Les nouveaux comptes restent inactifs jusqu'à la confirmation de l'adresse professionnelle.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_hash: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Patient(TimestampMixin, Base):
    __tablename__ = "patients"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)
    sex: Mapped[str | None] = mapped_column(String(1))
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str] = mapped_column(Text, nullable=False)
    governorate: Mapped[str] = mapped_column(String(100), nullable=False)
    # Conservé nullable pour compatibilité avec les anciennes lignes de la base.
    # Le nouveau formulaire ne le demande plus : l'application est exclusivement dédiée aux usagers de drogue.
    contact_class: Mapped[str | None] = mapped_column(String(150), nullable=True)
    profile_code: Mapped[str] = mapped_column(String(80), default="injecting_drug_use", index=True, nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(4), nullable=True)
    anonymized_code: Mapped[str | None] = mapped_column(String(19), unique=True, index=True, nullable=True)
    date_first_use: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_last_use: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_last_risk_exposure: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_sharing: Mapped[str | None] = mapped_column(String(3), nullable=True)
    previous_sharing: Mapped[str | None] = mapped_column(String(3), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    route: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[PatientStatus] = mapped_column(
    Enum(PatientStatus, name="patient_status", values_callable=enum_values),
    default=PatientStatus.form_progress)    
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))


class RiskAssessment(TimestampMixin, Base):
    __tablename__ = "risk_assessments"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), unique=True)
    responses: Mapped[dict] = mapped_column(JSONB, default=dict)
    completed_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))


class ScreeningTest(TimestampMixin, Base):
    __tablename__ = "screening_tests"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    test_type: Mapped[str] = mapped_column(String(10))  # TDR ou TROD
    result: Mapped[TestResult] = mapped_column(Enum(TestResult, name="test_result", values_callable=enum_values))
    tested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    performed_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    attested: Mapped[bool] = mapped_column(Boolean, nullable=False)
    attested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text)


class PcrTest(TimestampMixin, Base):
    __tablename__ = "pcr_tests"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    sample_date: Mapped[date] = mapped_column(Date)
    laboratory: Mapped[str] = mapped_column(String(200))
    result: Mapped[PcrResult] = mapped_column(Enum(PcrResult, name="pcr_result", values_callable=enum_values))
    viral_load: Mapped[float | None] = mapped_column(Numeric(14, 2))
    genotype: Mapped[str | None] = mapped_column(String(30))
    performed_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    attested: Mapped[bool] = mapped_column(Boolean, nullable=False)
    attested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Orientation(TimestampMixin, Base):
    __tablename__ = "orientations"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    facility: Mapped[str] = mapped_column(String(200))
    appointment_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[OrientationStatus] = mapped_column(
    Enum(
        OrientationStatus,
        name="orientation_status",
        values_callable=enum_values
    ),
    default=OrientationStatus.sent)    
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str | None] = mapped_column(Text)


class CareTask(TimestampMixin, Base):
    __tablename__ = "care_tasks"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    task_type: Mapped[TaskType] = mapped_column(
    Enum(TaskType, name="task_type", values_callable=enum_values)
)

    status: Mapped[TaskStatus] = mapped_column(
    Enum(TaskStatus, name="task_status", values_callable=enum_values),
    default=TaskStatus.open
)

    assigned_role: Mapped[Role] = mapped_column(
    Enum(Role, name="assigned_role", values_callable=enum_values)
)
    due_date: Mapped[date | None] = mapped_column(Date)
    created_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
class ReferralDoctor(TimestampMixin, Base):
    __tablename__ = "referral_doctors"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )

    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    facility: Mapped[str] = mapped_column(String(200))
    governorate: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    specialty: Mapped[str | None] = mapped_column(String(150))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

