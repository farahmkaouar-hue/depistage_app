import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ApiError,
  getCurrentUser,
  getLaboratoryAnalytics,
  getMedicalDashboard,
  getPatients,
  createPatient,
  saveRiskAssessment,
  createScreeningTest,
  createPcrTest,
  getCareTasks,
  createOrientation,
  getReferralDoctors,
  createReferralDoctor,
  updateReferralDoctor,
  type CurrentUser,
  type LaboratoryAnalytics,
  type MedicalDashboard,
  type Patient as ApiPatient,
  type CareTask,
  type ReferralDoctor,
  type ReferralDoctorCreate,
  login as loginRequest,
  register as registerRequest,
  verifyEmail
} from "./services/api";
// ── Types ──────────────────────────────────────────────────────────────────
type Role = "medecin" | "preleveur" | "direction";

type Screen =
  | "login"
  | "register"
  | "invite-register"
  // médecin
  | "dashboard"
  | "new-patient"
  | "dynamic-form"
  | "tdr"
  | "orientation"
  // préleveur
  | "prelev-list"
  | "genotyping"
  // direction
  | "dashboard"
  | "referral-doctors";

type PatientStatus =
  | "form-progress"
  | "tdr-pending"
  | "positive-alert"
  | "oriented"
  | "closed";

interface Patient {
  id: string;
  name: string;
  dob: string;
  status: PatientStatus;
  lastUpdated: string;
  anonymizedCode?: string;
}

const MOCK_PATIENTS: Patient[] = [];
const GENOTYPING_PENDING: Patient[] = [];

// ── Constants ──────────────────────────────────────────────────────────────
const GOVERNORATS = [
  "Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa",
  "Jendouba", "Kairouan", "Kasserine", "Kébili", "Kef", "Mahdia",
  "Manouba", "Médenine", "Monastir", "Nabeul", "Sfax", "Sidi Bouzid",
  "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan",
];

// ── Role configs ───────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<Role, {
  label: string;
  
  initials: string;
  name: string;
  accent: string;
  homeScreen: Screen;
  navItems: { id: Screen; label: string; icon: React.ReactNode }[];
}> = {
  medecin: {
    label: "Médecin",
    initials: "DR",
    name: "",
    accent: "#2176AE",
    homeScreen: "new-patient",
    navItems: [
      { id: "new-patient", label: "Nouveau patient", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" /></svg> },
      { id: "dashboard", label: "Tableau de bord", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
      { id: "genotyping", label: "Prélèvement / PCR", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3h8M9 3v5l-4 7a3 3 0 002.6 4.5h8.8A3 3 0 0019 15l-4-7V3" /></svg> },
      { id: "orientation", label: "Orientation", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M13 6l6 6-6 6" /></svg> },
    ],
  },
  preleveur: {
    label: "Préleveur",
    initials: "SM",
    name: "",
    accent: "#10997F",
    homeScreen: "prelev-list",
    navItems: [
      {
        id: "prelev-list",
        label: "Dossiers à prélever",
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      },
    ],
  },
  direction: {
  label: "Direction",
  initials: "",
  name: "Direction / Observatoire",
  accent: "#134074",
  homeScreen: "dashboard",
  navItems: [
    {
      id: "dashboard",
      label: "Indicateurs observatoire",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: "referral-doctors",
      label: "Médecins d'orientation",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ],
},
};

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PatientStatus }) {
  const map: Record<PatientStatus, { label: string; cls: string }> = {
    "form-progress": { label: "Formulaire en cours", cls: "bg-[#EAF3FB] text-[#1A5E9A] border border-[#BDDCF5]" },
    "tdr-pending": { label: "TDR en attente", cls: "bg-[#FEF7EA] text-[#C97A1A] border border-[#F5D9A8]" },
    "positive-alert": { label: "Résultat positif — action requise", cls: "bg-[#FEF1F0] text-[#D9372B] border border-[#F5B8B4] font-semibold" },
    oriented: { label: "Orienté", cls: "bg-[#E0F5F1] text-[#0D7A6B] border border-[#A5DDD4]" },
    closed: { label: "Clôturé", cls: "bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {status === "positive-alert" && <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-[#D9372B] inline-block animate-pulse" />}
      {label}
    </span>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ role, user, screen, onNavigate, onLogout }: {
  role: Role;
  user: CurrentUser | null;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const cfg = ROLE_CONFIG[role];
  const fullName = user ? `${user.first_name} ${user.last_name}` : "Utilisateur";
  const initials = user ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() : "U";
  const roleBadgeColor: Record<Role, string> = {
    medecin: "bg-[#2176AE]/20 text-[#3A8DC7]",
    preleveur: "bg-[#14B89A]/20 text-[#14B89A]",
    direction: "bg-white/10 text-white/70",
  };

  return (
    <aside className="w-64 bg-[#0B2545] text-white flex flex-col min-h-screen shrink-0">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#14B89A] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">VHC Dépistage</div>
            <div className="text-white/50 text-xs">Programme national</div>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 pt-4 pb-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadgeColor[role]}`}>
          {cfg.label}
        </span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {cfg.navItems.map((item) => {
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#2176AE] flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{fullName}</div>
              <div className="text-white/40 text-xs truncate">{user?.facility || cfg.label}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Se déconnecter"
            className="text-white/40 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────
function PageShell({ role, user, screen, onNavigate, onLogout, children }: {
  role: Role;
  user: CurrentUser | null;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      <Sidebar role={role} user={user} screen={screen} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

// ── Form helpers ───────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-[#374151] mb-1.5">{children}</label>;
}

function Input({ label, type = "text", placeholder = "", value, onChange, required }: {
  label?: string; type?: string; placeholder?: string;
  value?: string; onChange?: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      {label && <Label>{label}{required && <span className="text-[#D9372B] ml-0.5">*</span>}</Label>}
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full h-11 px-3.5 rounded-lg border border-[#DDE2EA] bg-white text-sm text-[#0B2545] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2176AE]/30 focus:border-[#2176AE] transition-colors"
      />
    </div>
  );
}

function Select({ label, options, value, onChange, required }: {
  label?: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      {label && <Label>{label}{required && <span className="text-[#D9372B] ml-0.5">*</span>}</Label>}
      <select
        value={value} onChange={(e) => onChange?.(e.target.value)}
        className="w-full h-11 px-3.5 rounded-lg border border-[#DDE2EA] bg-white text-sm text-[#0B2545] focus:outline-none focus:ring-2 focus:ring-[#2176AE]/30 focus:border-[#2176AE] transition-colors appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
      >
        <option value="">Sélectionner…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md", fullWidth, disabled = false }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "teal";
  size?: "sm" | "md" | "lg"; fullWidth?: boolean; disabled?: boolean;
}) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer select-none";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };
  const variants = {
    primary: "bg-[#2176AE] text-white hover:bg-[#1A5E9A] focus:ring-[#2176AE]/40",
    secondary: "bg-white text-[#374151] border border-[#DDE2EA] hover:bg-[#F3F4F6] focus:ring-[#2176AE]/20",
    ghost: "text-[#2176AE] hover:bg-[#EAF3FB] focus:ring-[#2176AE]/20",
    teal: "bg-[#0D7A6B] text-white hover:bg-[#0A6358] focus:ring-[#0D7A6B]/40",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

function Toast({ msg, type = "success", onClose }: { msg: string; type?: "success" | "info"; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium ${type === "success" ? "bg-[#0D7A6B] text-white" : "bg-[#134074] text-white"}`}>
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN — Login (sélection de rôle)
// ══════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, onNavigate }: {
  onLogin: (email: string, password: string) => Promise<void>;
  onNavigate: (s: Screen) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = async () => {
    if (!selectedRole || !email || !password) return;
    setError("");
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : "Connexion impossible");
    } finally {
      setIsSubmitting(false);
    }
  };

  const roles: { id: Role; label: string; desc: string; color: string; borderActive: string; bgActive: string; icon: React.ReactNode }[] = [
    {
      id: "medecin",
      label: "Médecin",
      desc: "Dépistage, suivi et orientation des patients",
      color: "text-[#2176AE]",
      borderActive: "border-[#2176AE]",
      bgActive: "bg-[#EAF3FB]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "preleveur",
      label: "Préleveur / Infirmier",
      desc: "Saisie des prélèvements et résultats PCR",
      color: "text-[#0D7A6B]",
      borderActive: "border-[#0D7A6B]",
      bgActive: "bg-[#E0F5F1]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: "direction",
      label: "Laboratoire",
      desc: "Cohorte pseudonymisée et indicateurs",
      color: "text-[#134074]",
      borderActive: "border-[#134074]",
      bgActive: "bg-[#EAF3FB]",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B2545] flex">
      {/* Left */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #2176AE 0%, transparent 60%), radial-gradient(circle at 80% 20%, #14B89A 0%, transparent 50%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[#14B89A] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg">VHC Dépistage</span>
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Programme national<br />de dépistage<br />de l'hépatite C
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            Plateforme sécurisée dédiée aux professionnels de santé pour le suivi coordonné des parcours de soin VHC.
          </p>
        </div>
        <div className="relative flex gap-8">
          {[{ val: "2 847", label: "Patients dépistés" }, { val: "68 %", label: "Taux de suivi" }, { val: "23", label: "Établissements" }].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-[#14B89A]">{s.val}</div>
              <div className="text-white/50 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F5F7FA]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-[#DDE2EA] p-8">
            <h2 className="text-[#0B2545] text-2xl font-bold mb-1">Connexion</h2>
            <p className="text-[#6B7280] text-sm mb-6">Sélectionnez votre profil d'accès</p>

            {/* Role selector */}
            <div className="space-y-2.5 mb-6">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${selectedRole === r.id ? `${r.borderActive} ${r.bgActive}` : "border-[#DDE2EA] hover:border-[#9CA3AF]/60"}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedRole === r.id ? r.bgActive : "bg-[#F5F7FA]"} ${r.color}`}>
                    {r.icon}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${selectedRole === r.id ? r.color : "text-[#374151]"}`}>{r.label}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">{r.desc}</div>
                  </div>
                  {selectedRole === r.id && (
                    <div className={`ml-auto w-5 h-5 rounded-full flex items-center justify-center ${r.borderActive.replace("border", "bg")}`}>
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <Input label="Email professionnel" type="email" placeholder="prenom.nom@etablissement.tn" value={email} onChange={setEmail} required />
              <Input label="Mot de passe" type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
              <div className="flex justify-end">
                <button className="text-sm text-[#2176AE] hover:text-[#1A5E9A]">Mot de passe oublié ?</button>
              </div>
              <button
                onClick={submitLogin}
                disabled={!selectedRole || !email || !password || isSubmitting}
                className="w-full h-12 rounded-lg text-base font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: selectedRole ? ROLE_CONFIG[selectedRole].accent : "#9CA3AF" }}
              >
                {isSubmitting ? "Connexion..." : "Se connecter"}
              </button>
              {error && <p className="text-sm text-[#D9372B]" role="alert">{error}</p>}
            </div>

            <div className="mt-6 pt-5 border-t border-[#DDE2EA] text-center">
              <span className="text-sm text-[#6B7280]">Pas encore de compte ? </span>
              <button onClick={() => onNavigate("register")} className="text-sm text-[#2176AE] font-medium hover:text-[#1A5E9A]">Créer un compte</button>
            </div>
          </div>
          <p className="text-center text-xs text-[#9CA3AF] mt-4">
            Accès réservé aux professionnels de santé habilités · Ministère de la Santé
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN — Création de compte
// ══════════════════════════════════════════════════════════════════════════
function RegisterScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [sent, setSent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"medecin" | "preleveur" | "direction">("medecin");
  const [facility, setFacility] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRegistration = async () => {
    if (!firstName || !lastName || !email || password.length < 8 || password !== confirmation || !facility || !governorate) {
      setError("Complétez les champs requis et vérifiez la confirmation du mot de passe.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await registerRequest({ email, password, first_name: firstName, last_name: lastName, role, facility, governorate });
      setSent(true);
    } catch (registrationError) {
      setError(registrationError instanceof ApiError ? registrationError.message : "Inscription impossible");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[#DDE2EA] p-10 w-full max-w-md text-center">
          <h2 className="text-xl font-bold text-[#0B2545] mb-2">Compte créé</h2>
          <p className="text-[#6B7280] text-sm mb-6">Votre compte professionnel est actif. Vous pouvez maintenant vous connecter.</p>
          <Btn variant="ghost" onClick={() => onNavigate("login")}>Retour à la connexion</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-[#DDE2EA] p-8">
          <h2 className="text-2xl font-bold text-[#0B2545] mb-1">Créer un compte professionnel</h2>
          <p className="text-[#6B7280] text-sm mb-8">Le compte est activé directement sur le serveur interne.</p>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Prénom" placeholder="Prénom" value={firstName} onChange={setFirstName} required />
              <Input label="Nom" placeholder="Nom" value={lastName} onChange={setLastName} required />
            </div>
            <Input label="Email professionnel" type="email" placeholder="prenom.nom@etablissement.tn" value={email} onChange={setEmail} required />
            <Select label="Rôle" options={["Médecin", "Préleveur / Infirmier"]} value={role === "preleveur" ? "Préleveur / Infirmier" : "Médecin"} onChange={(value) => setRole(value === "Préleveur / Infirmier" ? "preleveur" : "medecin")} required />
            <Select label="Établissement de santé" options={["Hôpital Charles Nicolle – Tunis", "CHU Farhat Hached – Sousse", "CHU Hédi Chaker – Sfax", "Hôpital Régional – Bizerte", "Autre"]} value={facility} onChange={setFacility} required />
            <Select label="Gouvernorat" options={GOVERNORATS} value={governorate} onChange={setGovernorate} required />
            <Input label="Mot de passe" type="password" placeholder="Au moins 8 caractères" value={password} onChange={setPassword} required />
            <Input label="Confirmer le mot de passe" type="password" placeholder="••••••••" value={confirmation} onChange={setConfirmation} required />
            {error && <p className="text-sm text-[#D9372B]" role="alert">{error}</p>}
            <Btn variant="primary" fullWidth size="lg" onClick={submitRegistration}>
              {isSubmitting ? "Envoi..." : "Créer mon compte"}
            </Btn>
          </div>
          <div className="mt-5 text-center">
            <button onClick={() => onNavigate("login")} className="text-sm text-[#6B7280] hover:text-[#374151]">← Retour à la connexion</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ESPACE MÉDECIN
// ══════════════════════════════════════════════════════════════════════════
function MedecinDashboard({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const [stats, setStats] = useState<MedicalDashboard | null>(null);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { const [dashboard, list] = await Promise.all([getMedicalDashboard(), getPatients()]); setStats(dashboard); setPatients(list); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Impossible de charger les données"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return <PageShell role="medecin" user={user} screen="dashboard" onNavigate={onNavigate} onLogout={onLogout}>
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8"><div><h1 className="text-2xl font-bold text-[#0B2545]">Tableau de bord</h1><p className="text-[#6B7280] text-sm mt-1">Gestion des dossiers — usagers de drogue</p></div><Btn variant="primary" size="lg" onClick={() => onNavigate("new-patient")}>+ Nouveau patient</Btn></div>
      {error && <div className="mb-4 rounded-lg border border-[#F5B8B4] bg-[#FEF1F0] p-3 text-sm text-[#D9372B]">{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">{[
        ["Patients", stats?.total_patients ?? 0], ["Dépistages en attente", stats?.pending_tdr ?? 0], ["Résultats positifs", stats?.positive_alerts ?? 0], ["Orientés / clôturés", stats?.oriented ?? 0]
      ].map(([label,value]) => <div key={String(label)} className="bg-white rounded-xl border border-[#DDE2EA] p-5"><div className="text-3xl font-bold text-[#2176AE]">{loading ? "…" : value}</div><div className="text-sm font-medium text-[#374151] mt-1">{label}</div></div>)}</div>
      <div className="bg-white rounded-xl border border-[#DDE2EA] overflow-hidden"><div className="px-6 py-4 border-b border-[#DDE2EA]"><h2 className="font-semibold text-[#0B2545]">Patients enregistrés</h2></div>
        {loading ? <div className="p-8 text-sm text-[#6B7280]">Chargement…</div> : patients.length === 0 ? <div className="p-8 text-sm text-[#6B7280]">Aucun patient enregistré.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-[#F5F7FA]"><th className="px-6 py-3 text-left">Identifiant</th><th className="px-6 py-3 text-left">Patient</th><th className="px-6 py-3 text-left">Code anonymisé</th><th className="px-6 py-3 text-left">Statut</th><th className="px-6 py-3 text-left">Mise à jour</th></tr></thead><tbody>{patients.map(p => <tr key={p.id} className="border-b hover:bg-[#F5F7FA]"><td className="px-6 py-4 font-mono text-xs">{p.patient_number}</td><td className="px-6 py-4 font-medium">{p.first_name} {p.last_name}</td><td className="px-6 py-4 font-mono text-xs text-[#2176AE]">{p.anonymized_code}</td><td className="px-6 py-4"><StatusBadge status={p.status} /></td><td className="px-6 py-4 text-xs text-[#6B7280]">{new Date(p.updated_at).toLocaleString("fr-TN")}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  </PageShell>;
}

function NewPatientScreen({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const [form, setForm] = useState({ first_name:"", last_name:"", maiden_name:"", date_of_birth:"", sex:"" as ""|"M"|"F", phone:"", address:"", governorate:"", postal_code:"" });
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
  const submit=()=>{
    setError("");
    if(!form.first_name||!form.last_name||!form.date_of_birth||!form.sex||!form.address||!form.governorate||!/^[0-9]{4}$/.test(form.postal_code)){setError("Veuillez remplir tous les champs obligatoires. Le code postal doit contenir 4 chiffres.");return;}
    localStorage.setItem("vhc_patient_draft",JSON.stringify(form)); onNavigate("dynamic-form");
  };
  return <PageShell role="medecin" user={user} screen="new-patient" onNavigate={onNavigate} onLogout={onLogout}><div className="p-8 max-w-3xl mx-auto"><div className="flex items-center gap-2 text-sm text-[#6B7280] mb-6"><button onClick={()=>onNavigate("dashboard")}>Tableau de bord</button><span>/</span><span>Nouveau patient</span></div><div className="bg-white rounded-xl border border-[#DDE2EA] p-8"><h2 className="text-lg font-bold text-[#0B2545] mb-6">Identité du patient</h2><div className="space-y-5"><div className="grid grid-cols-2 gap-4"><Input label="Nom" value={form.last_name} onChange={v=>set("last_name",v)} required/><Input label="Prénom" value={form.first_name} onChange={v=>set("first_name",v)} required/></div><div className="grid grid-cols-2 gap-4"><Input label="Nom de jeune fille (si applicable)" value={form.maiden_name} onChange={v=>set("maiden_name",v)}/><Input label="Date de naissance" type="date" value={form.date_of_birth} onChange={v=>set("date_of_birth",v)} required/></div><div className="grid grid-cols-2 gap-4"><Select label="Sexe" options={["Masculin","Féminin"]} value={form.sex==="M"?"Masculin":form.sex==="F"?"Féminin":""} onChange={v=>set("sex",v==="Masculin"?"M":"F")} required/><Input label="Téléphone" type="tel" value={form.phone} onChange={v=>set("phone",v)}/></div><Input label="Adresse" placeholder="Rue, numéro, ville" value={form.address} onChange={v=>set("address",v)} required/><div className="grid grid-cols-2 gap-4"><Select label="Gouvernorat" options={GOVERNORATS} value={form.governorate} onChange={v=>set("governorate",v)} required/><Input label="Code postal" placeholder="1000" value={form.postal_code} onChange={v=>set("postal_code",v.replace(/\D/g,"").slice(0,4))} required/></div><div className="rounded-lg bg-[#EAF3FB] border border-[#BDDCF5] p-4 text-sm text-[#1A5E9A]">Profil appliqué automatiquement : <strong>Usager ou ancien usager de drogues</strong>. Aucun choix de classe de contact n'est nécessaire.</div>{error&&<p className="text-sm text-[#D9372B]">{error}</p>}</div><div className="flex justify-between mt-8 pt-6 border-t"><Btn variant="secondary" onClick={()=>onNavigate("dashboard")}>Annuler</Btn><Btn variant="primary" size="lg" disabled={saving} onClick={submit}>{saving?"Enregistrement…":"Continuer →"}</Btn></div></div></div></PageShell>;
}

function FormSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#E8C9A0]/60 border border-[#D4A96A]/40 rounded-t-lg px-4 py-2.5">
      <span className="text-sm font-bold text-[#7A4A1A] uppercase tracking-wide">{children}</span>
    </div>
  );
}

function RadioBtn({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
        checked ? "border-[#2176AE] bg-[#EAF3FB] text-[#1A5E9A]" : "border-[#DDE2EA] text-[#374151] hover:border-[#2176AE]/40 hover:bg-[#F5F7FA]"
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? "border-[#2176AE]" : "border-[#9CA3AF]"}`}>
        {checked && <div className="w-2 h-2 rounded-full bg-[#2176AE]" />}
      </div>
      {label}
    </button>
  );
}

function DynamicFormScreen({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const draft = JSON.parse(localStorage.getItem("vhc_patient_draft") || "null");
  const [dateFirst,setDateFirst]=useState(""); const [dateLast,setDateLast]=useState(""); const [dateExposure,setDateExposure]=useState(""); const [currentSharing,setCurrentSharing]=useState<""|"Oui"|"Non">(""); const [previousSharing,setPreviousSharing]=useState<""|"Oui"|"Non">(""); const [frequency,setFrequency]=useState(""); const [route,setRoute]=useState(""); const [error,setError]=useState(""); const [saving,setSaving]=useState(false);
  const submit=async()=>{setError(""); if(!draft){setError("Brouillon patient introuvable.");return;} if(!dateFirst||!dateLast||!dateExposure||!currentSharing||!previousSharing||!frequency||!route){setError("Tous les champs obligatoires doivent être renseignés.");return;} if(dateLast<dateFirst){setError("La date du dernier usage doit être postérieure ou égale à la date du premier usage.");return;} if(dateExposure>new Date().toISOString().slice(0,10)){setError("La date de dernière exposition ne peut pas être future.");return;} setSaving(true); try { const patient=await createPatient({first_name:draft.first_name,last_name:draft.last_name,maiden_name:draft.maiden_name||null,date_of_birth:draft.date_of_birth,sex:draft.sex,phone:draft.phone||null,address:draft.address,governorate:draft.governorate,postal_code:draft.postal_code,date_first_use:dateFirst,date_last_use:dateLast,date_last_risk_exposure:dateExposure,current_sharing:currentSharing,previous_sharing:previousSharing,frequency,route}); await saveRiskAssessment(patient.id,{date_first_use:dateFirst,date_last_use:dateLast,date_last_risk_exposure:dateExposure,current_sharing:currentSharing,previous_sharing:previousSharing,frequency,route,profile_code:"injecting_drug_use"}); localStorage.removeItem("vhc_patient_draft"); localStorage.setItem("vhc_patient_id",patient.id); localStorage.setItem("vhc_patient_code",patient.anonymized_code); onNavigate("tdr"); } catch(err){setError(err instanceof ApiError?err.message:"Impossible d'enregistrer le patient.");} finally{setSaving(false);} };
  return <PageShell role="medecin" user={user} screen="dynamic-form" onNavigate={onNavigate} onLogout={onLogout}><div className="p-8 max-w-3xl mx-auto"><div className="bg-white rounded-xl border border-[#DDE2EA] overflow-hidden mb-4"><div className="bg-[#0B2545] px-6 py-4 text-center"><p className="text-white/70 text-xs uppercase tracking-widest">PNE VHC 2016-2030</p><p className="text-[#14B89A] text-sm font-bold uppercase">Questionnaire — Usager de drogue</p></div><div className="p-5 text-sm text-[#374151]">Patient : <strong>{draft?.first_name} {draft?.last_name}</strong></div></div><div className="bg-white rounded-xl border border-[#DDE2EA] p-6 space-y-5"><FormSectionHeader>Usage de drogues</FormSectionHeader><div className="grid grid-cols-2 gap-4"><Input label="Date du premier usage" type="date" value={dateFirst} onChange={setDateFirst} required/><Input label="Date du dernier usage" type="date" value={dateLast} onChange={setDateLast} required/><Input label="Date de dernière exposition à risque" type="date" value={dateExposure} onChange={setDateExposure} required/><Select label="Fréquence d'utilisation" options={["Quotidienne","Plusieurs fois/semaine","Hebdomadaire","Occasionnelle"]} value={frequency} onChange={setFrequency} required/></div><div><Label>Partage actuel de matériel<span className="text-[#D9372B]"> *</span></Label><div className="flex gap-3">{["Oui","Non"].map(v=><RadioBtn key={v} label={v} checked={currentSharing===v} onClick={()=>setCurrentSharing(v as "Oui"|"Non")}/>)}</div></div><div><Label>Antécédent de partage<span className="text-[#D9372B]"> *</span></Label><div className="flex gap-3">{["Oui","Non"].map(v=><RadioBtn key={v} label={v} checked={previousSharing===v} onClick={()=>setPreviousSharing(v as "Oui"|"Non")}/>)}</div></div><div><Label>Voie d'usage<span className="text-[#D9372B]"> *</span></Label><div className="flex gap-3">{["Injectable","Nasale","Autre"].map(v=><RadioBtn key={v} label={v} checked={route===v} onClick={()=>setRoute(v)}/>)}</div></div>{error&&<p className="text-sm text-[#D9372B]">{error}</p>}</div><div className="flex justify-between mt-4"><Btn variant="secondary" onClick={()=>onNavigate("new-patient")}>← Retour</Btn><Btn variant="primary" size="lg" disabled={saving} onClick={submit}>{saving?"Enregistrement…":"Enregistrer le patient →"}</Btn></div></div></PageShell>;
}

function AttestationCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${checked ? "border-[#0D7A6B] bg-[#E0F5F1]" : "border-[#DDE2EA] bg-[#F5F7FA]"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0D7A6B]" />
      <span className="text-sm text-[#374151]"><span className="font-semibold">Attestation obligatoire.</span> {label}</span>
    </label>
  );
}

function TDRResultBtns({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "positif" | "negatif" | "douteux") => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {([
        { val: "negatif", label: "Négatif", icon: "−", active: "border-[#0D7A6B] bg-[#E0F5F1] text-[#0D7A6B]", hover: "hover:border-[#0D7A6B]/30 hover:bg-[#F0FAF8]" },
        { val: "positif", label: "Positif", icon: "+", active: "border-[#D9372B] bg-[#FEF1F0] text-[#D9372B]", hover: "hover:border-[#D9372B]/30 hover:bg-[#FEF1F0]/50" },
        { val: "douteux", label: "Douteux", icon: "?", active: "border-[#C97A1A] bg-[#FEF7EA] text-[#C97A1A]", hover: "hover:border-[#C97A1A]/30 hover:bg-[#FEF7EA]/50" },
      ] as const).map(({ val, label, icon, active, hover }) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 font-semibold text-sm transition-all ${value === val ? active + " ring-2 ring-offset-1 ring-current/40" : "border-[#DDE2EA] text-[#374151] " + hover}`}
        >
          <span className="text-2xl font-bold">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

function TDRScreen({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const [tdr,setTdr]=useState<""|"positif"|"negatif"|"douteux">(""); const [trod,setTrod]=useState<""|"positif"|"negatif"|"douteux">(""); const [a1,setA1]=useState(false); const [a2,setA2]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const date=new Date().toISOString().slice(0,10); const patientId=localStorage.getItem("vhc_patient_id"); const code=localStorage.getItem("vhc_patient_code");
  const submit=async()=>{setError(""); if(!patientId){setError("Patient introuvable. Recommencez la création du dossier.");return;} if(!tdr||!trod||!a1||!a2){setError("Le TDR, le TROD et leurs attestations sont obligatoires.");return;} setSaving(true); try { await createScreeningTest(patientId,{test_type:"TDR",result:tdr,tested_at:`${date}T12:00:00`,attested:true}); await createScreeningTest(patientId,{test_type:"TROD",result:trod,tested_at:`${date}T12:05:00`,attested:true}); localStorage.removeItem("vhc_patient_id");localStorage.removeItem("vhc_patient_code");onNavigate("dashboard"); } catch(err){setError(err instanceof ApiError?err.message:"Impossible d'enregistrer le dépistage.");} finally{setSaving(false);} };
  return <PageShell role="medecin" user={user} screen="tdr" onNavigate={onNavigate} onLogout={onLogout}><div className="p-8 max-w-3xl mx-auto"><div className="bg-white rounded-xl border border-[#DDE2EA] p-6 mb-4"><h1 className="text-xl font-bold text-[#0B2545]">Dépistage VHC — TDR + TROD</h1><p className="text-sm text-[#6B7280] mt-1">Code anonymisé : <span className="font-mono text-[#2176AE]">{code||"—"}</span></p><p className="text-xs text-[#6B7280] mt-2">Les deux tests sont obligatoires et réalisés le même jour.</p></div><div className="bg-white rounded-xl border border-[#DDE2EA] p-6 space-y-6"><div><Label>Date du dépistage</Label><input value={date} readOnly className="w-full h-11 px-3 rounded-lg border bg-[#F5F7FA]"/></div><div><Label>Résultat TDR<span className="text-[#D9372B]"> *</span></Label><TDRResultBtns value={tdr} onChange={setTdr}/></div><AttestationCheckbox checked={a1} onChange={setA1} label="Je certifie avoir réalisé ou vérifié le TDR."/><div className="border-t pt-5"><Label>Résultat TROD<span className="text-[#D9372B]"> *</span></Label><TDRResultBtns value={trod} onChange={setTrod}/><p className="text-xs text-[#6B7280] mt-2">Date verrouillée : {date}</p></div><AttestationCheckbox checked={a2} onChange={setA2} label="Je certifie avoir réalisé ou vérifié le TROD."/>{error&&<p className="text-sm text-[#D9372B]">{error}</p>}</div><div className="flex justify-between mt-4"><Btn variant="secondary" onClick={()=>onNavigate("dynamic-form")}>← Retour</Btn><Btn variant="primary" size="lg" disabled={saving} onClick={submit}>{saving?"Enregistrement…":"Enregistrer TDR + TROD"}</Btn></div></div></PageShell>;
}

const DOCTOR_DIRECTORY = [
  { name: "Dr. Mehdi Gharbi", spec: "Hépatologue", etab: "CHU Hédi Chaker – Sfax", tel: "+216 74 241 333", mail: "m.gharbi@chu-sfax.tn", adresse: "Av. de la République, Sfax 3029" },
  { name: "Dr. Sonia Karray", spec: "Infectiologue", etab: "CHU Habib Bourguiba – Sfax", tel: "+216 74 246 100", mail: "s.karray@chub-sfax.tn", adresse: "Rue Ain Chakroun, Sfax 3029" },
  { name: "Dr. Kamel Ayari", spec: "Hépatologue", etab: "CHU Farhat Hached – Sousse", tel: "+216 73 221 411", mail: "k.ayari@chu-sousse.tn", adresse: "Av. Ibn El Jazzar, Sousse 4000" },
  { name: "Dr. Nadia Zouari", spec: "Gastro-entérologue", etab: "Hôpital Régional – Sfax", tel: "+216 74 213 100", mail: "n.zouari@hr-sfax.tn", adresse: "Rue Farhat Hached, Sfax 3000" },
];

function OrientationScreen({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const [patients,setPatients]=useState<ApiPatient[]>([]);
  const [doctors,setDoctors]=useState<Array<{id:string;name:string;facility:string;email:string}>>([]);
  const [selected,setSelected]=useState("");
  const [doctorEmail,setDoctorEmail]=useState("");
  const [date,setDate]=useState("");
  const [decision,setDecision]=useState<""|"sent"|"refused">("");
  const [error,setError]=useState("");
  const [sent,setSent]=useState(false);

  useEffect(()=>{
    Promise.all([getPatients("positive-alert"), getReferralDoctors()])
      .then(([p,d])=>{
        setPatients(p);
        setDoctors(d.filter(doctor => doctor.is_active).map(doctor => ({
          id: doctor.id,
          name: `${doctor.first_name} ${doctor.last_name}`,
          facility: doctor.facility || "",
          email: doctor.email || "",
        })));
      })
      .catch(e=>setError(e instanceof ApiError?e.message:"Impossible de charger les orientations."));
  },[]);

  const selectedDoctor=doctors.find(d=>d.email===doctorEmail);
  const submit=async()=>{
    if(!selected||!decision){setError("Sélectionnez le patient et indiquez sa décision.");return;}
    if(decision==="sent"&&!selectedDoctor){setError("Sélectionnez un médecin traitant.");return;}
    try{
      await createOrientation(selected,{
        facility:selectedDoctor?.facility||"",
        doctor_name:selectedDoctor?.name,
        doctor_email:selectedDoctor?.email,
        appointment_date:date||undefined,
        status:decision,
      });
      setSent(true);setError("");
    }catch(e){setError(e instanceof ApiError?e.message:"Orientation impossible.");}
  };

  return <PageShell role="medecin" user={user} screen="orientation" onNavigate={onNavigate} onLogout={onLogout}>
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0B2545] mb-2">Orientation après dépistage</h1>
      <p className="text-sm text-[#6B7280] mb-6">Cette étape apparaît après une PCR détectable. Le médecin demande au patient s'il souhaite être orienté vers un médecin traitant.</p>
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <Select label="Patient" options={patients.map(p=>`${p.id} — ${p.first_name} ${p.last_name} — ${p.anonymized_code}`)} value={selected?`${selected} — ${patients.find(p=>p.id===selected)?.first_name||""} ${patients.find(p=>p.id===selected)?.last_name||""} — ${patients.find(p=>p.id===selected)?.anonymized_code||""}`:""} onChange={v=>setSelected(v.split(" — ")[0])} required/>
        <div><Label>Le patient souhaite-t-il être orienté ? *</Label><div className="flex gap-3"><Btn variant={decision==="sent"?"teal":"secondary"} onClick={()=>setDecision("sent")}>Oui, orienter</Btn><Btn variant={decision==="refused"?"primary":"secondary"} onClick={()=>setDecision("refused")}>Non, ne pas orienter</Btn></div></div>
        {decision==="sent"&&<>
          <Select label="Médecin traitant destinataire" options={doctors.map(d=>`${d.email} — ${d.name} — ${d.facility}`)} value={doctorEmail?`${doctorEmail} — ${selectedDoctor?.name||""} — ${selectedDoctor?.facility||""}`:""} onChange={v=>setDoctorEmail(v.split(" — ")[0])} required/>
          <Input label="Date du rendez-vous souhaitée" type="date" value={date} onChange={setDate}/></>}
        {sent&&<div className="p-3 rounded-lg bg-[#E0F5F1] text-[#0D7A6B] text-sm">Décision enregistrée. {decision==="sent"?"La demande a été envoyée au médecin traitant.":"Le refus d'orientation a été enregistré."}</div>}
        {error&&<div className="p-3 rounded-lg bg-[#FEF1F0] text-[#D9372B] text-sm">{error}</div>}
        <div className="flex justify-between"><Btn variant="secondary" onClick={()=>onNavigate("dashboard")}>Retour</Btn><Btn variant="primary" disabled={sent} onClick={submit}>Enregistrer la décision</Btn></div>
      </div>
    </div>
  </PageShell>;
}

// ══════════════════════════════════════════════════════════════════════════
// ESPACE PRÉLEVEUR
// ══════════════════════════════════════════════════════════════════════════
function PreleveurListScreen({ user, onNavigate, onLogout, role = "preleveur" }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void; role?: Role }) {
 const [patients,setPatients]=useState<ApiPatient[]>([]); const [error,setError]=useState("");
 useEffect(()=>{getPatients("positive-alert").then(setPatients).catch(e=>setError(e instanceof ApiError?e.message:"Impossible de charger les prélèvements."));},[]);
 return <PageShell role={role} user={user} screen="prelev-list" onNavigate={onNavigate} onLogout={onLogout}><div className="p-8 max-w-5xl mx-auto"><h1 className="text-2xl font-bold text-[#0B2545]">Dossiers à prélever</h1><p className="text-sm text-[#6B7280] mt-1 mb-6">Patients avec TDR/TROD positif — prélèvement PCR/CV à réaliser.</p>{error&&<p className="text-sm text-[#D9372B] mb-4">{error}</p>}{patients.length===0?<div className="bg-white border rounded-xl p-8 text-sm text-[#6B7280]">Aucun dossier en attente de prélèvement.</div>:<div className="space-y-3">{patients.map(p=><div key={p.id} className="bg-white border rounded-xl p-5 flex justify-between items-center"><div><div className="font-semibold text-[#0B2545]">{p.first_name} {p.last_name}</div><div className="font-mono text-xs text-[#6B7280]">{p.patient_number} · {p.anonymized_code}</div></div><Btn variant="teal" onClick={()=>onNavigate("genotyping")}>Saisir prélèvement →</Btn></div>)}</div>}</div></PageShell>;
}

function GenotypingScreen({ user, onNavigate, onLogout, role = "preleveur" }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void; role?: Role }) {
 const [patients,setPatients]=useState<ApiPatient[]>([]); const [patientId,setPatientId]=useState(""); const [pcr,setPcr]=useState<""|"detectable"|"indetectable">(""); const [viral,setViral]=useState(""); const [geno,setGeno]=useState(""); const [lab,setLab]=useState(""); const [attested,setAttested]=useState(false); const [error,setError]=useState(""); const [saving,setSaving]=useState(false);
 useEffect(()=>{getPatients("positive-alert").then(setPatients).catch(e=>setError(e instanceof ApiError?e.message:"Impossible de charger les dossiers."));},[]);
 const submit=async()=>{if(!patientId||!pcr||!lab||!attested){setError("Patient, laboratoire, résultat PCR et attestation sont obligatoires.");return;}setSaving(true);try{await createPcrTest(patientId,{sample_date:new Date().toISOString().slice(0,10),laboratory:lab,result:pcr,viral_load:viral?Number(viral):null,genotype:geno||null,attested:true});onNavigate(role==="medecin"&&pcr==="detectable"?"orientation":"prelev-list");}catch(e){setError(e instanceof ApiError?e.message:"Impossible d'enregistrer le prélèvement.");}finally{setSaving(false);}};
 return <PageShell role={role} user={user} screen="prelev-list" onNavigate={onNavigate} onLogout={onLogout}><div className="p-8 max-w-3xl mx-auto"><h1 className="text-2xl font-bold text-[#0B2545] mb-6">Prélèvement PCR / Génotypage</h1><div className="bg-white border rounded-xl p-6 space-y-5"><Select label="Patient" options={patients.map(p=>`${p.id} — ${p.first_name} ${p.last_name} — ${p.anonymized_code}`)} value={patientId?`${patientId} — ${patients.find(p=>p.id===patientId)?.first_name||""} ${patients.find(p=>p.id===patientId)?.last_name||""} — ${patients.find(p=>p.id===patientId)?.anonymized_code||""}`:""} onChange={v=>setPatientId(v.split(" — ")[0])} required/><Input label="Laboratoire référant" value={lab} onChange={setLab} required/><div><Label>Résultat PCR *</Label><div className="flex gap-3"><RadioBtn label="Détectable" checked={pcr==="detectable"} onClick={()=>setPcr("detectable")}/><RadioBtn label="Indétectable" checked={pcr==="indetectable"} onClick={()=>setPcr("indetectable")}/></div></div>{pcr==="detectable"&&<Input label="Charge virale (UI/mL)" type="number" value={viral} onChange={setViral}/>}<Input label="Génotype VHC" value={geno} onChange={setGeno}/><AttestationCheckbox checked={attested} onChange={setAttested} label="Je certifie que le prélèvement et les résultats saisis sont exacts."/>{error&&<p className="text-sm text-[#D9372B]">{error}</p>}<div className="flex justify-between"><Btn variant="secondary" onClick={()=>onNavigate("prelev-list")}>Retour</Btn><Btn variant="teal" disabled={saving} onClick={submit}>{saving?"Enregistrement…":"Enregistrer le prélèvement"}</Btn></div></div></div></PageShell>;
}

// ══════════════════════════════════════════════════════════════════════════
// ESPACE DIRECTION
// ══════════════════════════════════════════════════════════════════════════
const positivityData = [{ name: "Usager de drogue", taux: 0 }];

const gouvernoratData = [
  { name: "Sfax", value: 38 },
  { name: "Tunis", value: 29 },
  { name: "Sousse", value: 21 },
  { name: "Bizerte", value: 14 },
  { name: "Gabès", value: 11 },
  { name: "Autre", value: 22 },
];

const cascadeData = [
  { name: "Dépistés", value: 284, fill: "#2176AE" },
  { name: "Confirmés", value: 193, fill: "#3A8DC7" },
  { name: "Orientés", value: 141, fill: "#10997F" },
  { name: "Traités", value: 98, fill: "#0D7A6B" },
];

const GOUVCOLORS = ["#2176AE", "#3A8DC7", "#14B89A", "#10997F", "#0D7A6B", "#DDE2EA"];

function LaboratoryDashboard({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  const [data, setData] = useState<LaboratoryAnalytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getLaboratoryAnalytics().then(setData).catch((requestError) => setError(requestError instanceof ApiError ? requestError.message : "Les indicateurs sont indisponibles."));
  }, []);

  const kpis = data?.kpis;
  const cascade = data?.cascade;
  return (
    <PageShell role="direction" user={user} screen="dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1"><h1 className="text-2xl font-bold text-[#0B2545]">Indicateurs laboratoire</h1><span className="px-2 py-0.5 rounded-full bg-[#E0F5F1] text-[#0D7A6B] text-xs font-medium border border-[#A5DDD4]">Lecture seule</span></div>
            <p className="text-[#6B7280] text-sm">Surveillance épidémiologique VHC et qualité du parcours</p>
          </div>
          <div className="max-w-xs text-xs text-[#6B7280] bg-[#F5F7FA] border border-[#DDE2EA] px-3 py-2 rounded-lg">Aucun nom, contact, adresse, date de naissance ou numéro de dossier patient n’est accessible.</div>
        </div>
        {error && <div className="mb-5 rounded-lg border border-[#F5B8B4] bg-[#FEF1F0] p-4 text-sm text-[#D9372B]">{error}</div>}
        {!data && !error && <div className="rounded-xl border border-[#DDE2EA] bg-white p-8 text-sm text-[#6B7280]">Chargement des indicateurs…</div>}
        {data && <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Patients dépistés", value: kpis?.patients_screened ?? 0, note: "Cohorte active", color: "text-[#2176AE]" },
              { label: "Positivité dépistage", value: kpis?.screening_positivity_percent == null ? "—" : `${kpis.screening_positivity_percent} %`, note: `${kpis?.screening_tests ?? 0} tests`, color: "text-[#C97A1A]" },
              { label: "PCR en attente", value: kpis?.pcr_pending ?? 0, note: "À traiter", color: "text-[#D9372B]" },
              { label: "Orientation après positif", value: kpis?.orientation_rate_percent == null ? "—" : `${kpis.orientation_rate_percent} %`, note: "Lien vers le soin", color: "text-[#0D7A6B]" },
            ].map((item) => <div key={item.label} className="bg-white rounded-xl border border-[#DDE2EA] p-5"><div className={`text-3xl font-bold ${item.color}`}>{item.value}</div><div className="text-sm font-medium text-[#374151] mt-1">{item.label}</div><div className="text-xs text-[#9CA3AF] mt-0.5">{item.note}</div></div>)}
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-[#DDE2EA] p-6"><h3 className="font-semibold text-[#0B2545] text-sm mb-4">Dépistages par profil</h3><ResponsiveContainer width="100%" height={240}><BarChart data={data.by_contact_class} barSize={28}><CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DDE2EA" }} /><Bar dataKey="value" name="Patients" fill="#2176AE" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div className="bg-white rounded-xl border border-[#DDE2EA] p-6"><h3 className="font-semibold text-[#0B2545] text-sm mb-4">Répartition par gouvernorat</h3><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={data.by_governorate} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">{data.by_governorate.map((_, i) => <Cell key={i} fill={GOUVCOLORS[i % GOUVCOLORS.length]} />)}</Pie><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DDE2EA" }} /></PieChart></ResponsiveContainer></div>
          </div>
          <div className="bg-white rounded-xl border border-[#DDE2EA] p-6"><h3 className="font-semibold text-[#0B2545] text-sm mb-5">Cascade de suivi</h3><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[{ label: "Dépistés", value: cascade?.screened ?? 0 }, { label: "Positifs en suivi", value: cascade?.positive ?? 0 }, { label: "Orientés", value: cascade?.oriented ?? 0 }, { label: "Clôturés", value: cascade?.closed ?? 0 }].map((step) => <div key={step.label} className="rounded-lg border border-[#DDE2EA] bg-[#F5F7FA] p-4"><div className="text-2xl font-bold text-[#0D7A6B]">{step.value}</div><div className="text-xs text-[#6B7280] mt-1">{step.label}</div></div>)}</div><p className="text-xs text-[#9CA3AF] mt-5">Les catégories avec moins de {data.suppression_threshold} patients sont masquées dans les répartitions.</p></div>
        </>}
      </div>
    </PageShell>
  );
}

function DirectionScreen({ user, onNavigate, onLogout }: { user: CurrentUser | null; onNavigate: (s: Screen) => void; onLogout: () => void }) {
  return <LaboratoryDashboard user={user} onNavigate={onNavigate} onLogout={onLogout} />;
}
// ══════════════════════════════════════════════════════════════════════════
// ÉCRAN — MÉDECINS D'ORIENTATION
// Réservé à la Direction
// ══════════════════════════════════════════════════════════════════════════

function ReferralDoctorsScreen({
  user,
  onNavigate,
  onLogout,
}: {
  user: CurrentUser | null;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const [doctors, setDoctors] = useState<ReferralDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<ReferralDoctor | null>(null);

  const [form, setForm] = useState<ReferralDoctorCreate>({
    first_name: "",
    last_name: "",
    facility: "",
    governorate: "",
    specialty: "",
    email: "",
    phone: "",
    is_active: true,
  });

  const loadDoctors = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getReferralDoctors();
      setDoctors(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les médecins d'orientation."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const resetForm = () => {
    setForm({
      first_name: "",
      last_name: "",
      facility: "",
      governorate: "",
      specialty: "",
      email: "",
      phone: "",
      is_active: true,
    });

    setEditingDoctor(null);
    setShowForm(false);
  };

  const updateField = (
    field: keyof ReferralDoctorCreate,
    value: string | boolean
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openAddForm = () => {
    setSuccess("");
    setError("");

    setEditingDoctor(null);

    setForm({
      first_name: "",
      last_name: "",
      facility: "",
      governorate: "",
      specialty: "",
      email: "",
      phone: "",
      is_active: true,
    });

    setShowForm(true);
  };

  const openEditForm = (doctor: ReferralDoctor) => {
    setSuccess("");
    setError("");

    setEditingDoctor(doctor);

    setForm({
      first_name: doctor.first_name,
      last_name: doctor.last_name,
      facility: doctor.facility || "",
      governorate: doctor.governorate || "",
      specialty: doctor.specialty || "",
      email: doctor.email || "",
      phone: doctor.phone || "",
      is_active: doctor.is_active,
    });

    setShowForm(true);
  };

  const saveDoctor = async () => {
    setError("");
    setSuccess("");

    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.facility.trim() ||
      !form.governorate.trim() ||
      !form.specialty.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setSaving(true);

    try {
      if (editingDoctor) {
        await updateReferralDoctor(editingDoctor.id, form);

        setSuccess("Médecin modifié avec succès.");
      } else {
        await createReferralDoctor(form);

        setSuccess("Médecin ajouté avec succès.");
      }

      resetForm();
      await loadDoctors();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer le médecin."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleDoctor = async (doctor: ReferralDoctor) => {
    setError("");
    setSuccess("");

    const action = doctor.is_active ? "désactiver" : "réactiver";

    const confirmed = window.confirm(
      `Voulez-vous vraiment ${action} le Dr. ${doctor.first_name} ${doctor.last_name} ?`
    );

    if (!confirmed) return;

    try {
      await updateReferralDoctor(doctor.id, {
        is_active: !doctor.is_active,
      });

      setSuccess(
        doctor.is_active
          ? "Médecin désactivé."
          : "Médecin réactivé."
      );

      await loadDoctors();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de modifier le statut du médecin."
      );
    }
  };

  return (
    <PageShell
      role="direction"
      user={user}
      screen="referral-doctors"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="p-8 max-w-6xl mx-auto">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[#0B2545]">
                Médecins d'orientation
              </h1>

              <span className="px-2 py-0.5 rounded-full bg-[#E0F5F1] text-[#0D7A6B] text-xs font-medium border border-[#A5DDD4]">
                Direction
              </span>
            </div>

            <p className="text-[#6B7280] text-sm">
              Gestion des médecins destinataires des orientations VHC.
            </p>
          </div>

          <div className="flex gap-2">
            <Btn
              variant="secondary"
              onClick={loadDoctors}
              disabled={loading}
            >
              ↻ Actualiser
            </Btn>

            <Btn
              variant="primary"
              onClick={openAddForm}
            >
              + Ajouter un médecin
            </Btn>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 rounded-lg border border-[#F5B8B4] bg-[#FEF1F0] p-4 text-sm text-[#D9372B]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-[#A5DDD4] bg-[#E0F5F1] p-4 text-sm text-[#0D7A6B]">
            {success}
          </div>
        )}

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-xl border border-[#DDE2EA] p-6 mb-6">

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#0B2545]">
                  {editingDoctor
                    ? "Modifier le médecin"
                    : "Ajouter un médecin"}
                </h2>

                <p className="text-sm text-[#6B7280] mt-1">
                  Les informations seront utilisées pour les orientations VHC.
                </p>
              </div>

              <button
                onClick={resetForm}
                className="text-[#6B7280] hover:text-[#374151] text-sm"
              >
                ✕ Fermer
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">

              <Input
                label="Prénom"
                value={form.first_name}
                onChange={(value) =>
                  updateField("first_name", value)
                }
                required
              />

              <Input
                label="Nom"
                value={form.last_name}
                onChange={(value) =>
                  updateField("last_name", value)
                }
                required
              />

              <Input
                label="Spécialité"
                placeholder="Hépatologue, infectiologue..."
                value={form.specialty}
                onChange={(value) =>
                  updateField("specialty", value)
                }
                required
              />

              <Input
                label="Établissement"
                value={form.facility}
                onChange={(value) =>
                  updateField("facility", value)
                }
                required
              />

              <Select
                label="Gouvernorat"
                options={GOVERNORATS}
                value={form.governorate}
                onChange={(value) =>
                  updateField("governorate", value)
                }
                required
              />

              <Input
                label="Téléphone"
                type="tel"
                placeholder="+216 XX XXX XXX"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
                required
              />

              <Input
                label="Email"
                type="email"
                placeholder="medecin@hopital.tn"
                value={form.email}
                onChange={(value) =>
                  updateField("email", value)
                }
                required
              />

              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active !== false}
                    onChange={(event) =>
                      updateField(
                        "is_active",
                        event.target.checked
                      )
                    }
                    className="h-4 w-4 accent-[#0D7A6B]"
                  />

                  <span className="text-sm font-medium text-[#374151]">
                    Médecin actif
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-[#DDE2EA]">
              <Btn
                variant="secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Annuler
              </Btn>

              <Btn
                variant="primary"
                onClick={saveDoctor}
                disabled={saving}
              >
                {saving
                  ? "Enregistrement..."
                  : editingDoctor
                    ? "Enregistrer les modifications"
                    : "Ajouter le médecin"}
              </Btn>
            </div>
          </div>
        )}

        {/* Liste */}
        <div className="bg-white rounded-xl border border-[#DDE2EA] overflow-hidden">

          <div className="px-6 py-4 border-b border-[#DDE2EA] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#0B2545]">
                Liste des médecins
              </h2>

              <p className="text-xs text-[#9CA3AF] mt-1">
                {doctors.length} médecin
                {doctors.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#6B7280]">
              Chargement des médecins...
            </div>
          ) : doctors.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">👨‍⚕️</div>

              <h3 className="font-semibold text-[#0B2545] mb-1">
                Aucun médecin enregistré
              </h3>

              <p className="text-sm text-[#6B7280] mb-5">
                Ajoutez le premier médecin d'orientation.
              </p>

              <Btn
                variant="primary"
                onClick={openAddForm}
              >
                + Ajouter un médecin
              </Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">

                <thead>
                  <tr className="border-b border-[#DDE2EA] bg-[#F5F7FA]">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Médecin
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Spécialité
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Établissement
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Gouvernorat
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Contact
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                      Statut
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {doctors.map((doctor, index) => (
                    <tr
                      key={doctor.id}
                      className={`hover:bg-[#F5F7FA] ${
                        index < doctors.length - 1
                          ? "border-b border-[#DDE2EA]"
                          : ""
                      }`}
                    >

                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0B2545]">
                          Dr. {doctor.first_name}{" "}
                          {doctor.last_name}
                        </div>

                        <div className="text-xs text-[#9CA3AF] mt-0.5">
                          {doctor.email}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-[#374151]">
                        {doctor.specialty || "—"}
                      </td>

                      <td className="px-6 py-4 text-[#6B7280]">
                        {doctor.facility || "—"}
                      </td>

                      <td className="px-6 py-4 text-[#6B7280]">
                        {doctor.governorate || "—"}
                      </td>

                      <td className="px-6 py-4 text-[#6B7280]">
                        {doctor.phone || "—"}
                      </td>

                      <td className="px-6 py-4">
                        {doctor.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E0F5F1] text-[#0D7A6B] border border-[#A5DDD4]">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                            Inactif
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() =>
                              openEditForm(doctor)
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#2176AE] bg-[#EAF3FB] hover:bg-[#DCECF8] transition-colors"
                          >
                            Modifier
                          </button>

                          <button
                            onClick={() =>
                              toggleDoctor(doctor)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              doctor.is_active
                                ? "text-[#D9372B] bg-[#FEF1F0] hover:bg-[#FCE2E0]"
                                : "text-[#0D7A6B] bg-[#E0F5F1] hover:bg-[#D3F0EA]"
                            }`}
                          >
                            {doctor.is_active
                              ? "Désactiver"
                              : "Réactiver"}
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-[#DDE2EA] bg-[#F5F7FA] p-4">
          <p className="text-xs text-[#6B7280]">
            <strong className="text-[#374151]">
              Information :
            </strong>{" "}
            les médecins désactivés restent enregistrés dans le système
            mais ne sont plus disponibles pour les nouvelles orientations.
          </p>
        </div>

      </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT — routing par rôle
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [screen, setScreen] = useState<Screen>("login");

  useEffect(() => {
    const token = localStorage.getItem("vhc_access_token");
    if (!token) return;

    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        setRole(user.role);
        setScreen(ROLE_CONFIG[user.role].homeScreen);
      })
      .catch(() => {
        localStorage.removeItem("vhc_access_token");
        setCurrentUser(null);
        setRole(null);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    localStorage.setItem("vhc_access_token", response.access_token);
    const user = response.user ?? await getCurrentUser();
    setCurrentUser(user);
    setRole(user.role);
    setScreen(ROLE_CONFIG[user.role].homeScreen);
  };

  const logout = () => {
    localStorage.removeItem("vhc_access_token");
    setCurrentUser(null);
    setRole(null);
    setScreen("login");
  };

  const nav = (s: Screen) => setScreen(s);

  if (!role && (screen === "register" || screen === "invite-register")) return <RegisterScreen onNavigate={nav} />;
  if (!role || screen === "login") return <LoginScreen onLogin={login} onNavigate={nav} />;

  // Médecin
  if (role === "medecin") {
    if (screen === "dashboard") return <MedecinDashboard user={currentUser} onNavigate={nav} onLogout={logout} />;
    if (screen === "new-patient") return <NewPatientScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
    if (screen === "dynamic-form") return <DynamicFormScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
    if (screen === "tdr") return <TDRScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
    if (screen === "genotyping") return <GenotypingScreen user={currentUser} onNavigate={nav} onLogout={logout} role="medecin" />;
    if (screen === "orientation") return <OrientationScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
  }

  // Préleveur
  if (role === "preleveur") {
    if (screen === "prelev-list") return <PreleveurListScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
    if (screen === "genotyping") return <GenotypingScreen user={currentUser} onNavigate={nav} onLogout={logout} />;
  }

  // Direction
  // Direction
if (role === "direction") {
  if (screen === "dashboard") {
    return (
      <DirectionScreen
        user={currentUser}
        onNavigate={nav}
        onLogout={logout}
      />
    );
  }

  if (screen === "referral-doctors") {
    return (
      <ReferralDoctorsScreen
        user={currentUser}
        onNavigate={nav}
        onLogout={logout}
      />
    );
  }
}

  return <LoginScreen onLogin={login} onNavigate={nav} />;
}
