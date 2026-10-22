from email.message import EmailMessage
import smtplib
from datetime import date

from .config import get_settings


def _smtp_send(message: EmailMessage) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from:
        raise RuntimeError("Le service e-mail interne n'est pas configuré")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def send_orientation_email(doctor_email: str, doctor_name: str, patient_number: str, anonymized_code: str, appointment_date: date | None) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = "Orientation VHC — demande de rendez-vous"
    message["From"] = settings.smtp_from
    message["To"] = doctor_email
    date_text = appointment_date.isoformat() if appointment_date else "À convenir"
    message.set_content(
        f"Bonjour Dr {doctor_name},\n\n"
        "Une orientation VHC vous est adressée depuis la plateforme interne de dépistage.\n"
        f"Dossier: {patient_number}\n"
        f"Code pseudonymisé: {anonymized_code}\n"
        f"Date de rendez-vous souhaitée: {date_text}\n\n"
        "Le message est transmis via la connexion TLS du serveur de messagerie interne. "
        "Les données nominatives du patient ne sont pas incluses dans l'e-mail.\n"
    )
    _smtp_send(message)
