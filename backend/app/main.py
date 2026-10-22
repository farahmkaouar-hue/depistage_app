from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from uuid import UUID

from sqlalchemy import select, func, and_, not_

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import (
    AuditLog,
    CareTask,
    TaskStatus,
    TaskType,
    Patient,
    PatientStatus,
    User,
    Role,
    RiskAssessment,
    ScreeningTest,
    TestResult,
    PcrTest,
    PcrResult,
    Orientation,
    OrientationStatus,
    ReferralDoctor,
    
)
from .profiles import RISK_PROFILES, get_profile
from .anonymization import generate_anonymized_code
from .schemas import (
    CareTaskUpdate,
    DashboardResponse,
    LoginRequest,
    OrientationCreate,
    OrientationUpdate,
    PatientCreate,
    PatientResponse,
    PcrTestCreate,
    RiskAssessmentCreate,
    ScreeningTestCreate,
    TokenResponse,
    RegistrationResponse,
    UserRegister,
    DoctorDirectoryItem,
    ReferralDoctorCreate,
    ReferralDoctorUpdate,
    ReferralDoctorResponse,
)
from .security import create_access_token, decode_token, hash_password, invalid_credentials, verify_password
from .email import send_orientation_email


app = FastAPI(title="API VHC Dépistage", version="1.0.0")
get_settings().assert_production_ready()
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer()
login_attempts: dict[str, deque[datetime]] = defaultdict(deque)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    return response


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    # Un compte non vérifié ne doit jamais obtenir de session, même si son mot de passe est correct.
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise invalid_credentials()
    user = db.get(User, user_id)
    if not user or not user.is_active or not user.email_verified:
        raise invalid_credentials()
    return user


def require_roles(*roles: Role):
    def check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé pour ce rôle")
        return user
    return check


def get_patient_or_404(patient_id: UUID, db: Session) -> Patient:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return patient


def next_patient_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    # La séquence PostgreSQL évite les doublons lorsque plusieurs utilisateurs créent un dossier en même temps.
    sequence_value = db.scalar(text("SELECT nextval('patient_number_seq')"))
    return f"PAT-{year}-{sequence_value:05d}"


def audit(db: Session, user: User, action: str, entity_type: str, entity_id: UUID) -> None:
    db.add(AuditLog(actor_id=user.id, action=action, entity_type=entity_type, entity_id=entity_id))


def anonymized_case_code(patient_id: UUID) -> str:
    digest = hmac.new(get_settings().analytics_pseudonym_secret.encode(), str(patient_id).encode(), hashlib.sha256).hexdigest()
    return f"VHC-{digest[:12].upper()}"


def age_band(date_of_birth) -> str:
    today = datetime.now(timezone.utc).date()
    age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
    if age < 18:
        return "<18"
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    if age < 55:
        return "45-54"
    return "55+"


def check_login_rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    attempts = login_attempts[key]
    cutoff = now - timedelta(minutes=1)
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    if len(attempts) >= get_settings().request_rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez dans une minute.")
    attempts.append(now)


def has_open_task(db: Session, patient_id: UUID, task_type: TaskType) -> bool:
    return db.scalar(select(CareTask.id).where(CareTask.patient_id == patient_id, CareTask.task_type == task_type, CareTask.status == TaskStatus.open).limit(1)) is not None


def complete_tasks(db: Session, patient_id: UUID, task_type: TaskType) -> None:
    for task in db.scalars(select(CareTask).where(CareTask.patient_id == patient_id, CareTask.task_type == task_type, CareTask.status == TaskStatus.open)):
        task.status = TaskStatus.done
        task.completed_at = datetime.now(timezone.utc)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/risk-profiles")
def list_risk_profiles(_: User = Depends(require_roles(Role.medecin))) -> list[dict]:
    """Contrat à consommer par un formulaire dynamique côté front."""
    return RISK_PROFILES


@app.post("/api/auth/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> RegistrationResponse:
    settings = get_settings()
    if not settings.allow_public_registration:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Les inscriptions sont actuellement fermées")
    email = str(payload.email).lower()
    domain = email.rsplit("@", 1)[-1]
    # Une liste vide est volontairement permissive seulement pour les essais locaux.
    if settings.allowed_email_domain_list and domain not in settings.allowed_email_domain_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Domaine e-mail professionnel non autorisé")
    if payload.role == Role.direction:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Le rôle Direction doit être créé par un administrateur")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Cette adresse e-mail est déjà utilisée")
    # Dans le serveur interne, l'authentification repose sur le compte professionnel créé
    # directement dans l'application : aucune vérification par e-mail n'est nécessaire.
    user = User(
        email=email, password_hash=hash_password(payload.password), first_name=payload.first_name,
        last_name=payload.last_name, role=payload.role, facility=payload.facility, governorate=payload.governorate,
        is_active=True, email_verified=True,
    )
    db.add(user)
    db.commit()
    return RegistrationResponse(message="Votre compte a été créé avec succès. Vous pouvez vous connecter.")


@app.get("/api/auth/verify-email", response_model=RegistrationResponse)
def verify_email(token: str, db: Session = Depends(get_db)) -> RegistrationResponse:
    # Le token est consommé en supprimant son hash ; un même lien ne peut donc pas être réutilisé.
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = db.scalar(select(User).where(User.email_verification_hash == token_hash))
    now = datetime.now(timezone.utc)
    if not user or not user.email_verification_expires_at or user.email_verification_expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lien de vérification invalide ou expiré")
    user.email_verified = True
    user.is_active = True
    user.email_verification_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return RegistrationResponse(message="Adresse vérifiée. Vous pouvez maintenant vous connecter.")


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    check_login_rate_limit(request)
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active or not user.email_verified:
        raise invalid_credentials()
    return TokenResponse(access_token=create_access_token(str(user.id), user.role.value), role=user.role)


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "facility": user.facility,
        "governorate": user.governorate,

    }

@app.get("/api/doctors", response_model=list[DoctorDirectoryItem])
def list_doctors(
    db: Session = Depends(get_db),
     _: User = Depends(require_roles(Role.direction))
):
    """Liste des médecins d'orientation gérés par le laboratoire."""

    doctors = db.scalars(
        select(ReferralDoctor)
        .where(ReferralDoctor.is_active.is_(True))
        .order_by(ReferralDoctor.last_name, ReferralDoctor.first_name)
    )

    return [
        {
            "id": doctor.id,
            "name": f"Dr. {doctor.first_name} {doctor.last_name}",
            "facility": doctor.facility,
            "email": doctor.email,
        }
        for doctor in doctors
    ]

@app.get("/api/orientations/candidates", response_model=list[PatientResponse])
def orientation_candidates(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.medecin))) -> list[Patient]:
    """Patients ayant une PCR détectable et pas encore d'orientation."""
    orientation_exists = select(Orientation.id).where(Orientation.patient_id == Patient.id).exists()
    query = (
        select(Patient)
        .join(PcrTest, PcrTest.patient_id == Patient.id)
        .where(PcrTest.result == PcrResult.detectable, not_(orientation_exists))
        .order_by(Patient.updated_at.desc())
        .distinct()
    )
    return list(db.scalars(query))


@app.get("/api/patients", response_model=list[PatientResponse])
def list_patients(status_filter: PatientStatus | None = None, search: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin, Role.preleveur))) -> list[Patient]:
    query = select(Patient).order_by(Patient.updated_at.desc())
    if user.role == Role.preleveur:
        # Le préleveur ne voit que les dossiers qui lui sont utiles pour un prélèvement PCR ouvert.
        query = (
            query.join(CareTask, CareTask.patient_id == Patient.id)
            .where(Patient.status == PatientStatus.positive_alert, CareTask.task_type == TaskType.pcr, CareTask.status == TaskStatus.open)
            .distinct()
        )
    elif status_filter:
        query = query.where(Patient.status == status_filter)
    if search and user.role == Role.medecin:
        term = f"%{search.strip()}%"
        query = query.where((Patient.patient_number.ilike(term)) | (Patient.first_name.ilike(term)) | (Patient.last_name.ilike(term)))
    return list(db.scalars(query))


@app.post("/api/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin))) -> Patient:
    try:
        anonymized_code = generate_anonymized_code(
            payload.first_name, payload.last_name, payload.date_of_birth,
            payload.sex, payload.governorate, payload.postal_code, payload.maiden_name
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if db.scalar(select(Patient.id).where(Patient.anonymized_code == anonymized_code)):
        raise HTTPException(status_code=409, detail="Un dossier avec ce code anonymisé existe déjà.")
    data = payload.model_dump(exclude={"maiden_name", "anonymized_code"})
    data["profile_code"] = "injecting_drug_use"
    data["contact_class"] = "Usager de drogue"
    patient = Patient(patient_number=next_patient_number(db), created_by_id=user.id, anonymized_code=anonymized_code, status=PatientStatus.tdr_pending, **data)
    db.add(patient)
    db.flush()
    if not has_open_task(db, patient.id, TaskType.screening):
        db.add(CareTask(patient_id=patient.id, task_type=TaskType.screening, assigned_role=Role.medecin, created_by_id=user.id))
    audit(db, user, "patient.created", "patient", patient.id)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/api/patients/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: UUID, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.medecin))) -> Patient:
    return get_patient_or_404(patient_id, db)


@app.post("/api/patients/{patient_id}/risk-assessment", status_code=status.HTTP_201_CREATED)
def save_risk_assessment(patient_id: UUID, payload: RiskAssessmentCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin))) -> dict:
    patient = get_patient_or_404(patient_id, db)
    assessment = db.scalar(select(RiskAssessment).where(RiskAssessment.patient_id == patient.id))
    if assessment:
        assessment.responses = payload.responses
        assessment.completed_by_id = user.id
    else:
        db.add(RiskAssessment(patient_id=patient.id, responses=payload.responses, completed_by_id=user.id))
    patient.status = PatientStatus.tdr_pending
    if not has_open_task(db, patient.id, TaskType.screening):
        db.add(CareTask(patient_id=patient.id, task_type=TaskType.screening, assigned_role=Role.medecin, created_by_id=user.id))
    audit(db, user, "risk_assessment.saved", "patient", patient.id)
    db.commit()
    return {"message": "Questionnaire enregistré"}


@app.post("/api/patients/{patient_id}/screening-tests", status_code=status.HTTP_201_CREATED)
def create_screening_test(patient_id: UUID, payload: ScreeningTestCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin))) -> dict:
    patient = get_patient_or_404(patient_id, db)
    if not payload.attested:
        raise HTTPException(status_code=400, detail="L'attestation de réalisation est obligatoire.")
    tests = list(db.scalars(select(ScreeningTest).where(ScreeningTest.patient_id == patient.id)))
    if any(t.test_type == payload.test_type and t.tested_at.date() == payload.tested_at.date() for t in tests):
        raise HTTPException(status_code=409, detail=f"Un {payload.test_type} existe déjà pour ce patient à cette date.")
    if tests and any(t.tested_at.date() != payload.tested_at.date() for t in tests):
        raise HTTPException(status_code=400, detail="Le TDR et le TROD doivent obligatoirement être réalisés le même jour.")
    db.add(ScreeningTest(patient_id=patient.id, performed_by_id=user.id, **payload.model_dump()))
    complete_tasks(db, patient.id, TaskType.screening)
    all_results = [t.result for t in tests] + [payload.result]
    if TestResult.positif in all_results:
        patient.status = PatientStatus.positive_alert
        if not has_open_task(db, patient.id, TaskType.pcr):
            db.add(CareTask(patient_id=patient.id, task_type=TaskType.pcr, assigned_role=Role.preleveur, created_by_id=user.id))
    elif payload.test_type == "TROD" and payload.result == TestResult.negatif:
        patient.status = PatientStatus.closed
    else:
        patient.status = PatientStatus.tdr_pending
    audit(db, user, "screening_test.created", "patient", patient.id)
    db.commit()
    return {"message": f"{payload.test_type} enregistré", "status": patient.status, "tested_at": payload.tested_at}


@app.get("/api/samples/pending", response_model=list[PatientResponse])
def pending_samples(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.medecin, Role.preleveur))) -> list[Patient]:
    query = (
        select(Patient)
        .join(CareTask, CareTask.patient_id == Patient.id)
        .where(Patient.status == PatientStatus.positive_alert, CareTask.task_type == TaskType.pcr, CareTask.status == TaskStatus.open)
        .order_by(Patient.updated_at.desc())
    )
    return list(db.scalars(query))


@app.post("/api/patients/{patient_id}/pcr-tests", status_code=status.HTTP_201_CREATED)
def create_pcr_test(patient_id: UUID, payload: PcrTestCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin, Role.preleveur))) -> dict:
    patient = get_patient_or_404(patient_id, db)
    db.add(PcrTest(patient_id=patient.id, performed_by_id=user.id, **payload.model_dump()))
    complete_tasks(db, patient.id, TaskType.pcr)
    if payload.result == PcrResult.indetectable:
        patient.status = PatientStatus.closed
    else:
        patient.status = PatientStatus.positive_alert
        if not has_open_task(db, patient.id, TaskType.orientation):
            db.add(CareTask(patient_id=patient.id, task_type=TaskType.orientation, assigned_role=Role.medecin, created_by_id=user.id))
    audit(db, user, "pcr_test.created", "patient", patient.id)
    db.commit()
    return {"message": "Résultat PCR enregistré", "status": patient.status}


@app.post("/api/patients/{patient_id}/orientations", status_code=status.HTTP_201_CREATED)
def create_orientation(patient_id: UUID, payload: OrientationCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin))) -> dict:
    patient = get_patient_or_404(patient_id, db)
    if payload.status.value == "sent":
        if not payload.doctor_email or not payload.doctor_name:
            raise HTTPException(status_code=422, detail="Le médecin destinataire est obligatoire.")
            return {"message": "Erreur lors de la création de l'orientation"}
        doctor = db.scalar(select(ReferralDoctor).where(ReferralDoctor.email == payload.doctor_email,ReferralDoctor.is_active.is_(True)
            )
        )
        if not doctor:
            raise HTTPException(status_code=404, detail="Médecin destinataire introuvable ou inactif.")
        facility = doctor.facility or payload.facility or ""
        notes = payload.notes or ""
        notes = f"Médecin destinataire: {doctor.first_name} {doctor.last_name} | Email: {doctor.email}. {notes}".strip()
    else:
        doctor = None
        facility = "Refus d'orientation par le patient"
        notes = payload.notes or "Le patient ne souhaite pas être orienté."

    orientation = Orientation(
        patient_id=patient.id, created_by_id=user.id, facility=facility,
        appointment_date=payload.appointment_date, status=payload.status, notes=notes
    )
    patient.status = PatientStatus.oriented if payload.status.value == "sent" else PatientStatus.closed
    db.add(orientation)
    complete_tasks(db, patient.id, TaskType.orientation)
    audit(db, user, "orientation.created" if payload.status.value == "sent" else "orientation.refused", "patient", patient.id)
    db.commit()

    if doctor:
        send_orientation_email(doctor.email, f"{doctor.first_name} {doctor.last_name}", patient.patient_number, patient.anonymized_code or "", payload.appointment_date)

    return {"id": orientation.id, "message": "Orientation envoyée" if doctor else "Refus d'orientation enregistré"}


@app.patch("/api/orientations/{orientation_id}")
def update_orientation(orientation_id: UUID, payload: OrientationUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.medecin))) -> dict:
    orientation = db.get(Orientation, orientation_id)
    if not orientation:
        raise HTTPException(status_code=404, detail="Orientation introuvable")
    orientation.status = payload.status
    db.commit()
    return {"message": "Orientation mise à jour"}


@app.get("/api/care-tasks")
def list_care_tasks(open_only: bool = True, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin, Role.preleveur))) -> list[dict]:
    query = select(CareTask, Patient.patient_number, Patient.first_name, Patient.last_name).join(Patient, CareTask.patient_id == Patient.id)
    if open_only:
        query = query.where(CareTask.status == TaskStatus.open)
    if user.role == Role.preleveur:
        query = query.where(CareTask.assigned_role == Role.preleveur)
    return [{"id": task.id, "type": task.task_type, "status": task.status, "due_date": task.due_date, "patient_number": number, "patient_name": f"{first_name} {last_name}"} for task, number, first_name, last_name in db.execute(query.order_by(CareTask.created_at.desc()))]


@app.patch("/api/care-tasks/{task_id}")
def update_care_task(task_id: UUID, payload: CareTaskUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.medecin, Role.preleveur))) -> dict:
    task = db.get(CareTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    if user.role == Role.preleveur and task.assigned_role != Role.preleveur:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cette tâche n'est pas assignée à votre rôle")
    task.status = TaskStatus(payload.status)
    if task.status == TaskStatus.done:
        task.completed_at = datetime.now(timezone.utc)
    audit(db, user, "care_task.updated", "care_task", task.id)
    db.commit()
    return {"message": "Tâche mise à jour"}


@app.get("/api/dashboard/medical", response_model=DashboardResponse)
def medical_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.medecin))) -> DashboardResponse:
    def count(status_value: PatientStatus | None = None) -> int:
        query = select(func.count(Patient.id))
        if status_value:
            query = query.where(Patient.status == status_value)
        return db.scalar(query) or 0
    oriented = count(PatientStatus.oriented)
    closed = count(PatientStatus.closed)
    return DashboardResponse(total_patients=count(), pending_tdr=count(PatientStatus.tdr_pending), positive_alerts=count(PatientStatus.positive_alert), oriented=oriented + closed, closed=closed, orientation_rate_percent=round(100 * oriented / (oriented + closed), 1) if (oriented + closed) else None)


@app.get("/api/analytics/direction")
def direction_analytics(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.direction))) -> dict:
    # Aucun identifiant patient n'est renvoyé à la Direction.
    minimum_group_size = get_settings().analytics_min_group_size
    by_contact = [("Usager de drogue", db.scalar(select(func.count(Patient.id))) or 0)]
    by_governorate = list(db.execute(select(Patient.governorate, func.count(Patient.id)).group_by(Patient.governorate)).all())
    statuses = dict(db.execute(select(Patient.status, func.count(Patient.id)).group_by(Patient.status)).all())
    total_screened = sum(statuses.values())
    screening_positive = db.scalar(select(func.count(ScreeningTest.id)).where(ScreeningTest.result == TestResult.positif)) or 0
    screening_total = db.scalar(select(func.count(ScreeningTest.id))) or 0
    pcr_detectable = db.scalar(select(func.count(PcrTest.id)).where(PcrTest.result == PcrResult.detectable)) or 0
    pcr_total = db.scalar(select(func.count(PcrTest.id))) or 0
    pcr_pending = db.scalar(select(func.count(CareTask.id)).where(CareTask.task_type == TaskType.pcr, CareTask.status == TaskStatus.open)) or 0
    oriented = statuses.get(PatientStatus.oriented, 0)
    return {
        "by_contact_class": [{"name": name, "value": value} for name, value in by_contact if value >= minimum_group_size],
        "by_governorate": [{"name": name or "Non renseigné", "value": value} for name, value in by_governorate if value >= minimum_group_size],
        "suppression_threshold": minimum_group_size,
        "kpis": {
            "patients_screened": total_screened,
            "screening_tests": screening_total,
            "screening_positivity_percent": round(100 * screening_positive / screening_total, 1) if screening_total else None,
            "pcr_tests": pcr_total,
            "pcr_detectable_percent": round(100 * pcr_detectable / pcr_total, 1) if pcr_total else None,
            "pcr_pending": pcr_pending,
            "orientation_rate_percent": round(100 * oriented / screening_positive, 1) if screening_positive else None,
        },
        "cascade": {"screened": total_screened, "positive": statuses.get(PatientStatus.positive_alert, 0), "oriented": oriented, "closed": statuses.get(PatientStatus.closed, 0)},
    }


@app.get("/api/laboratory/cohort")
def laboratory_cohort(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.direction))) -> dict:
    """Cohorte pseudonymisée pour le laboratoire, sans nom, téléphone, adresse, DOB ni numéro patient."""
    limit = min(max(limit, 1), 500)
    patients = list(db.scalars(select(Patient).order_by(Patient.updated_at.desc()).limit(limit)))
    rows = []
    for patient in patients:
        latest_screening = db.scalar(select(ScreeningTest).where(ScreeningTest.patient_id == patient.id).order_by(ScreeningTest.tested_at.desc()).limit(1))
        latest_pcr = db.scalar(select(PcrTest).where(PcrTest.patient_id == patient.id).order_by(PcrTest.created_at.desc()).limit(1))
        rows.append({
            "case_code": anonymized_case_code(patient.id), "age_band": age_band(patient.date_of_birth), "sex": patient.sex,
            "governorate": patient.governorate, "risk_profile": patient.profile_code,
            "screening_result": latest_screening.result if latest_screening else None,
            "pcr_result": latest_pcr.result if latest_pcr else None, "genotype": latest_pcr.genotype if latest_pcr else None,
            "status": patient.status,
        })
    audit(db, user, "laboratory.cohort_accessed", "cohort", user.id)
    db.commit()
    return {"rows": rows, "suppression_threshold": get_settings().analytics_min_group_size, "notice": "Cohorte pseudonymisée : aucune donnée personnelle n'est fournie."}
@app.get("/api/referral-doctors")
def list_referral_doctors(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.direction))
):
    doctors = db.scalars(
        select(ReferralDoctor)
        .order_by(ReferralDoctor.last_name, ReferralDoctor.first_name)
    )

    return [
        {
            "id": doctor.id,
            "first_name": doctor.first_name,
            "last_name": doctor.last_name,
            "facility": doctor.facility,
            "governorate": doctor.governorate,
            "specialty": doctor.specialty,
            "email": doctor.email,
            "phone": doctor.phone,
            "is_active": doctor.is_active,
        }
        for doctor in doctors
    ]
@app.post("/api/referral-doctors")
def create_referral_doctor(
    payload: ReferralDoctorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.direction))
):
    doctor = ReferralDoctor(**payload.model_dump())

    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return doctor
@app.patch("/api/referral-doctors/{doctor_id}")
def update_referral_doctor(
    doctor_id: UUID,
    payload: ReferralDoctorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.direction))
):
    doctor = db.get(ReferralDoctor, doctor_id)

    if not doctor:
        raise HTTPException(
            status_code=404,
            detail="Médecin introuvable"
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(doctor, key, value)

    db.commit()
    db.refresh(doctor)

    return doctor


