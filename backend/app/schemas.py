from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import OrientationStatus, PcrResult, PatientStatus, Role, TestResult


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    role: Role = Role.medecin
    facility: str | None = None
    governorate: str | None = None


class RegistrationResponse(BaseModel):
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    maiden_name: str | None = Field(default=None, max_length=100)
    date_of_birth: date
    sex: str = Field(pattern="^[MF]$")
    phone: str | None = Field(default=None, max_length=30)
    address: str = Field(min_length=1, max_length=500)
    governorate: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(pattern=r"^\d{4}$")
    date_first_use: date
    date_last_use: date
    date_last_risk_exposure: date
    current_sharing: str = Field(pattern="^(Oui|Non)$")
    previous_sharing: str = Field(pattern="^(Oui|Non)$")
    frequency: str | None = None
    route: str | None = None
    anonymized_code: str | None = None

    @field_validator("date_last_use")
    @classmethod
    def validate_last_use(cls, value: date, info):
        first = info.data.get("date_first_use")
        if first and value < first:
            raise ValueError("La date du dernier usage doit être postérieure ou égale à la date du premier usage.")
        return value

    @field_validator("date_last_risk_exposure")
    @classmethod
    def validate_last_exposure(cls, value: date):
        if value > date.today():
            raise ValueError("La date de dernière exposition ne peut pas être dans le futur.")
        return value


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    patient_number: str
    first_name: str
    last_name: str
    date_of_birth: date
    sex: str
    phone: str | None
    address: str
    governorate: str
    postal_code: str | None
    anonymized_code: str | None
    profile_code: str
    date_first_use: date | None
    date_last_use: date | None
    date_last_risk_exposure: date | None
    current_sharing: str | None
    previous_sharing: str | None
    frequency: str | None
    route: str | None
    status: PatientStatus
    created_at: datetime
    updated_at: datetime


class RiskAssessmentCreate(BaseModel):
    responses: dict[str, Any]


class ScreeningTestCreate(BaseModel):
    test_type: str = Field(pattern="^(TDR|TROD)$")
    result: TestResult
    tested_at: datetime
    attested: bool
    notes: str | None = None

    @field_validator("attested")
    @classmethod
    def require_attestation(cls, value: bool) -> bool:
        if not value:
            raise ValueError("L'attestation de réalisation est obligatoire")
        return value


class PcrTestCreate(BaseModel):
    sample_date: date
    laboratory: str
    result: PcrResult
    viral_load: float | None = Field(default=None, ge=0)
    genotype: str | None = None
    attested: bool

    @field_validator("attested")
    @classmethod
    def require_attestation(cls, value: bool) -> bool:
        if not value:
            raise ValueError("L'attestation de réalisation est obligatoire")
        return value


class DoctorDirectoryItem(BaseModel):
    id: UUID
    name: str
    facility: str
    email: EmailStr


class OrientationCreate(BaseModel):
    facility: str = ""
    doctor_name: str | None = None
    doctor_email: EmailStr | None = None
    appointment_date: date | None = None
    status: OrientationStatus = OrientationStatus.sent
    notes: str | None = None


class OrientationUpdate(BaseModel):
    status: OrientationStatus


class DashboardResponse(BaseModel):
    total_patients: int
    pending_tdr: int
    positive_alerts: int
    oriented: int


class CareTaskUpdate(BaseModel):
    status: str = Field(pattern="^(open|done|cancelled)$")
class ReferralDoctorCreate(BaseModel):
    first_name: str
    last_name: str
    facility: str
    governorate: str | None = None
    email: EmailStr
    phone: str | None = None
    specialty: str | None = None


class ReferralDoctorUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    facility: str | None = None
    governorate: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    specialty: str | None = None
    is_active: bool | None = None
class ReferralDoctorResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    facility: str
    governorate: str | None
    email: EmailStr
    phone: str | None
    specialty: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)