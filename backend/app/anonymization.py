from datetime import date

GOVERNORATE_CODES = {
    "Tunis": "11", "Ariana": "12", "Ben Arous": "13", "Manouba": "14",
    "Nabeul": "15", "Zaghouan": "16", "Bizerte": "17", "Béja": "21",
    "Jendouba": "22", "Le Kef": "23", "Kef": "23", "Siliana": "24",
    "Sousse": "31", "Monastir": "32", "Mahdia": "33", "Sfax": "34",
    "Kairouan": "41", "Kasserine": "42", "Sidi Bouzid": "43",
    "Gabès": "51", "Medenine": "52", "Médenine": "52", "Tataouine": "53",
    "Gafsa": "61", "Tozeur": "62", "Kebili": "63", "Kébili": "63",
}

def _letters(value: str) -> str:
    return "".join(c for c in value.upper().strip() if c.isalpha())

def generate_anonymized_code(first_name: str, last_name: str, date_of_birth: date, sex: str, governorate: str, postal_code: str, maiden_name: str | None = None) -> str:
    name = maiden_name.strip() if maiden_name else last_name
    p = _letters(first_name)
    n = _letters(name)
    if len(p) < 2 or len(n) < 2:
        raise ValueError("Le prénom et le nom doivent contenir au moins deux caractères.")
    gov = GOVERNORATE_CODES.get(governorate)
    if not gov:
        raise ValueError(f"Gouvernorat inconnu : {governorate}")
    if not postal_code.isdigit() or len(postal_code) != 4:
        raise ValueError("Le code postal doit contenir exactement 4 chiffres.")
    code = f"{p[0]}{p[1]}{n[0]}{n[1]}{date_of_birth:%d%m%Y}{sex.upper()}{gov}{postal_code}"
    if len(code) != 19:
        raise ValueError("Le code anonymisé généré doit contenir exactement 19 caractères.")
    return code
