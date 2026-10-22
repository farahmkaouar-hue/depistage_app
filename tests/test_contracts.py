from datetime import date, datetime, timezone

import pytest

from app.profiles import RISK_PROFILES, get_profile
from app.schemas import PatientCreate, PcrTestCreate, ScreeningTestCreate


def valid_patient(**overrides):
    data = dict(
        first_name="Ali",
        last_name="Mansour",
        date_of_birth=date(1990, 5, 12),
        sex="M",
        phone="+21600000000",
        address="Rue 1, Tunis",
        governorate="Tunis",
        postal_code="1000",
        date_first_use=date(2015, 1, 1),
        date_last_use=date(2026, 8, 20),
        date_last_risk_exposure=date(2026, 8, 20),
        current_sharing="Oui",
        previous_sharing="Non",
        frequency="Occasionnelle",
        route="Injectable",
    )
    data.update(overrides)
    return data


def test_only_validated_drug_use_profile_is_active() -> None:
    assert len(RISK_PROFILES) == 1
    assert RISK_PROFILES[0]["code"] == "injecting_drug_use"
    assert get_profile("hemodialysis") is None


def test_patient_requires_address_and_postal_code() -> None:
    PatientCreate(**valid_patient())
    with pytest.raises(ValueError):
        PatientCreate(**valid_patient(address=""))
    with pytest.raises(ValueError):
        PatientCreate(**valid_patient(postal_code="100"))


def test_patient_requires_last_use_and_last_exposure() -> None:
    with pytest.raises(ValueError):
        PatientCreate(**valid_patient(date_last_use=None))
    with pytest.raises(ValueError):
        PatientCreate(**valid_patient(date_last_risk_exposure=None))


def test_previous_sharing_is_yes_or_no() -> None:
    PatientCreate(**valid_patient(previous_sharing="Oui"))
    PatientCreate(**valid_patient(previous_sharing="Non"))
    with pytest.raises(ValueError):
        PatientCreate(**valid_patient(previous_sharing="Décrire ici"))


def test_screening_requires_attestation_and_date() -> None:
    with pytest.raises(ValueError):
        ScreeningTestCreate(test_type="TDR", result="positif", tested_at=datetime.now(timezone.utc), attested=False)
    ScreeningTestCreate(test_type="TDR", result="positif", tested_at=datetime.now(timezone.utc), attested=True)
    ScreeningTestCreate(test_type="TROD", result="negatif", tested_at=datetime.now(timezone.utc), attested=True)


def test_pcr_result_requires_attestation() -> None:
    with pytest.raises(ValueError):
        PcrTestCreate(sample_date="2026-08-25", laboratory="Laboratoire pilote", result="detectable", attested=False)
