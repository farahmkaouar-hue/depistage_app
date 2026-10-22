"""Profil unique de dépistage : usager/ancien usager de drogues."""

RISK_PROFILES = [
    {
        "code": "injecting_drug_use",
        "label": "Usager ou ancien usager de drogues",
        "version": 1,
        "questions": [
            {"id": "date_first_use", "label": "Date du premier usage", "type": "date", "required": True},
            {"id": "date_last_use", "label": "Date du dernier usage", "type": "date", "required": True},
            {"id": "date_last_risk_exposure", "label": "Date de la dernière exposition à risque", "type": "date", "required": True},
            {"id": "current_sharing", "label": "Partage actuel de matériel", "type": "radio", "required": True, "options": ["Oui", "Non"]},
            {"id": "previous_sharing", "label": "Antécédent de partage de matériel", "type": "radio", "required": True, "options": ["Oui", "Non"]},
            {"id": "frequency", "label": "Fréquence d'utilisation", "type": "select", "required": True, "options": ["Quotidienne", "Plusieurs fois/semaine", "Hebdomadaire", "Occasionnelle"]},
            {"id": "route", "label": "Voie d'usage", "type": "select", "required": True, "options": ["Injectable", "Nasale", "Autre"]},
        ],
    },
]

def get_profile(code: str) -> dict | None:
    return next((profile for profile in RISK_PROFILES if profile["code"] == code), None)
