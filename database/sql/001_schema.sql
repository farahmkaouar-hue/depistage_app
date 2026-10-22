CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SEQUENCE patient_number_seq START WITH 1;

CREATE TYPE role AS ENUM ('medecin', 'preleveur', 'direction');
CREATE TYPE patient_status AS ENUM ('form-progress', 'tdr-pending', 'positive-alert', 'oriented', 'closed');
CREATE TYPE test_result AS ENUM ('positif', 'negatif', 'douteux');
CREATE TYPE pcr_result AS ENUM ('detectable', 'indetectable');
CREATE TYPE orientation_status AS ENUM ('sent', 'confirmed', 'refused');
CREATE TYPE task_type AS ENUM ('screening', 'pcr', 'orientation', 'recontact');
CREATE TYPE task_status AS ENUM ('open', 'done', 'cancelled');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL,
  role role NOT NULL, facility VARCHAR(200), governorate VARCHAR(100), is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE, email_verification_hash VARCHAR(64) UNIQUE,
  email_verification_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_number VARCHAR(30) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, date_of_birth DATE NOT NULL,
  sex VARCHAR(1) CHECK (sex IN ('M', 'F')), phone VARCHAR(30), address TEXT, governorate VARCHAR(100),
  contact_class VARCHAR(150) NOT NULL, profile_code VARCHAR(80), status patient_status NOT NULL DEFAULT 'form-progress',
  created_by_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}', completed_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE screening_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_type VARCHAR(10) NOT NULL CHECK (test_type IN ('TDR', 'TROD')), result test_result NOT NULL,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now(), performed_by_id UUID NOT NULL REFERENCES users(id),
  attested BOOLEAN NOT NULL, attested_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pcr_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  sample_date DATE NOT NULL, laboratory VARCHAR(200) NOT NULL, result pcr_result NOT NULL,
  viral_load NUMERIC(14,2), genotype VARCHAR(30), performed_by_id UUID NOT NULL REFERENCES users(id),
  attested BOOLEAN NOT NULL, attested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orientations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility VARCHAR(200) NOT NULL, appointment_date DATE, status orientation_status NOT NULL DEFAULT 'sent',
  created_by_id UUID NOT NULL REFERENCES users(id), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE care_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  task_type task_type NOT NULL, status task_status NOT NULL DEFAULT 'open', assigned_role role NOT NULL,
  due_date DATE, created_by_id UUID NOT NULL REFERENCES users(id), completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL, entity_type VARCHAR(50) NOT NULL, entity_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_governorate ON patients(governorate);
CREATE INDEX idx_patients_profile_code ON patients(profile_code);
CREATE INDEX idx_screening_patient ON screening_tests(patient_id);
CREATE INDEX idx_pcr_patient ON pcr_tests(patient_id);
CREATE INDEX idx_orientation_patient ON orientations(patient_id);
CREATE INDEX idx_care_tasks_patient_status ON care_tasks(patient_id, status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
