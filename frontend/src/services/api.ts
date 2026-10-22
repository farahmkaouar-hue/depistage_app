const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PATCH";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function api<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown
): Promise<T> {
  const token = localStorage.getItem("vhc_access_token");

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message =
      typeof error?.detail === "string"
        ? error.detail
        : typeof error?.message === "string"
          ? error.message
          : "Une erreur est survenue";

    throw new ApiError(message, response.status);
  }

  // Évite une erreur si l'API renvoie 204 No Content.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type Role = "medecin" | "preleveur" | "direction";

export type CurrentUser = {
  id: number | string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  facility: string;
  governorate: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  role: Role;
  user?: CurrentUser;
};

export type PatientStatus =
  | "form-progress"
  | "tdr-pending"
  | "positive-alert"
  | "oriented"
  | "closed";

export type Patient = {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: "M" | "F";
  phone?: string | null;
  address: string;
  governorate: string;
  postal_code: string;
  anonymized_code: string;
  profile_code: string;
  date_first_use: string;
  date_last_use: string;
  date_last_risk_exposure: string;
  current_sharing: "Oui" | "Non";
  previous_sharing: "Oui" | "Non";
  frequency?: string | null;
  route?: string | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
};

export type MedicalDashboard = {
  total_patients: number;
  pending_tdr: number;
  positive_alerts: number;
  oriented: number;
};

export type CareTask = {
  id: string;
  type: "screening" | "pcr" | "orientation" | "recontact";
  status: "open" | "done" | "cancelled";
  due_date?: string | null;
  patient_number: string;
  patient_name: string;
};

export type DoctorDirectoryItem = {
  id: string;
  name: string;
  facility: string;
  email: string;
};

export type LaboratoryAnalytics = {
  suppression_threshold: number;
  by_contact_class: Array<{ name: string; value: number }>;
  by_governorate: Array<{ name: string; value: number }>;
  cascade: {
    screened: number;
    positive: number;
    oriented: number;
    closed: number;
  };
  kpis: {
    patients_screened: number;
    screening_tests: number;
    screening_positivity_percent: number | null;
    pcr_tests: number;
    pcr_detectable_percent: number | null;
    pcr_pending: number;
    orientation_rate_percent: number | null;
  };
};

export const login = (email: string, password: string) =>
  api<AuthResponse>("/api/auth/login", "POST", { email, password });

export const getCurrentUser = () => api<CurrentUser>("/api/auth/me");

export const register = (payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role;
  facility: string;
  governorate: string;
}) => api<{ message: string }>("/api/auth/register", "POST", payload);

export const getRiskProfiles = () => api("/api/risk-profiles");

export const getMedicalDashboard = () =>
  api<MedicalDashboard>("/api/dashboard/medical");

export const getPatients = (status?: PatientStatus) =>
  api<Patient[]>(
    status
      ? `/api/patients?status_filter=${encodeURIComponent(status)}`
      : "/api/patients"
  );

export const getOrientationCandidates = () =>
  api<Patient[]>("/api/orientations/candidates");

export const getDoctors = () => api<DoctorDirectoryItem[]>("/api/doctors");

export type CreatePatientPayload = {
  first_name: string;
  last_name: string;
  maiden_name?: string | null;
  date_of_birth: string;
  sex: "M" | "F";
  phone?: string | null;
  address: string;
  governorate: string;
  postal_code: string;
  date_first_use: string;
  date_last_use: string;
  date_last_risk_exposure: string;
  current_sharing: "Oui" | "Non";
  previous_sharing: "Oui" | "Non";
  frequency?: string | null;
  route?: string | null;
};

export const createPatient = (payload: CreatePatientPayload) =>
  api<Patient>("/api/patients", "POST", payload);

export const saveRiskAssessment = (
  patientId: string,
  responses: Record<string, unknown>
) =>
  api<{ message: string }>(
    `/api/patients/${patientId}/risk-assessment`,
    "POST",
    { responses }
  );

export const createScreeningTest = (
  patientId: string,
  payload: {
    test_type: "TDR" | "TROD";
    result: "positif" | "negatif" | "douteux";
    tested_at: string;
    attested: boolean;
    notes?: string;
  }
) =>
  api<{ message: string; status: PatientStatus; tested_at: string }>(
    `/api/patients/${patientId}/screening-tests`,
    "POST",
    payload
  );

export const getCareTasks = () => api<CareTask[]>("/api/care-tasks");

export const updateCareTask = (
  taskId: string,
  status: "open" | "done" | "cancelled"
) =>
  api<{ message: string }>(`/api/care-tasks/${taskId}`, "PATCH", { status });

export const createPcrTest = (
  patientId: string,
  payload: {
    sample_date: string;
    laboratory: string;
    result: "detectable" | "indetectable";
    viral_load?: number | null;
    genotype?: string | null;
    attested: boolean;
  }
) =>
  api<{ message: string }>(
    `/api/patients/${patientId}/pcr-tests`,
    "POST",
    payload
  );

export const createOrientation = (
  patientId: string,
  payload: {
    facility?: string;
    doctor_name?: string;
    doctor_email?: string;
    appointment_date?: string;
    status: "sent" | "refused";
    notes?: string;
  }
) =>
  api<{ id: string; message: string }>(
    `/api/patients/${patientId}/orientations`,
    "POST",
    payload
  );

export const getLaboratoryAnalytics = () =>
  api<LaboratoryAnalytics>("/api/analytics/direction");

// ══════════════════════════════════════════════════════════════════════════════
// MÉDECINS D'ORIENTATION — DIRECTION
// ══════════════════════════════════════════════════════════════════════════════

export type ReferralDoctor = {
  id: string;
  first_name: string;
  last_name: string;
  facility: string;
  governorate: string;
  specialty: string;
  email: string;
  phone: string;
  is_active: boolean;
};

export type ReferralDoctorCreate = {
  first_name: string;
  last_name: string;
  facility: string;
  governorate: string;
  specialty: string;
  email: string;
  phone: string;
  is_active?: boolean;
};

export type ReferralDoctorUpdate = Partial<ReferralDoctorCreate>;

export const getReferralDoctors = () =>
  api<ReferralDoctor[]>("/api/referral-doctors");

export const createReferralDoctor = (payload: ReferralDoctorCreate) =>
  api<ReferralDoctor>("/api/referral-doctors", "POST", payload);

export const updateReferralDoctor = (
  doctorId: string,
  payload: ReferralDoctorUpdate
) =>
  api<ReferralDoctor>(
    `/api/referral-doctors/${doctorId}`,
    "PATCH",
    payload
  );
