# VHC Dépistage

Application web de dépistage de l'hépatite C : parcours patient (questionnaire de risque, TDR/TROD, PCR, orientation), suivi opérationnel et indicateurs agrégés.

- **Rôles** : médecin, préleveur, laboratoire (aucun accès aux données personnelles pour ce dernier).
- **Stack** : FastAPI + PostgreSQL (backend), React + Vite (frontend), Docker Compose.
- **Lancement rapide** : copier `.env.example` vers `.env` et `backend/.env`, renseigner les secrets, puis `docker compose up --build -d`. Frontend sur http://localhost, API sur http://localhost:8000/docs.

---

# Backend — VHC Dépistage

API REST Python/FastAPI destinée au front React existant. La base est PostgreSQL et les rôles applicatifs sont `medecin`, `preleveur` et `direction` (affiché « Laboratoire » dans l'interface).

## Lancer en local

1. Copier `.env.example` vers `.env`, définir tous les secrets et les paramètres SMTP.
2. Créer l'environnement et installer les dépendances :

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Démarrer l'ensemble depuis ce dossier : `docker compose up --build -d`. L'API applique automatiquement les migrations Alembic à une base vide.

La documentation interactive est disponible sur `http://localhost:8000/docs`. Ne l'exposez pas publiquement en production sans protection réseau.

## Initialisation d'une base vide

1. Configurer les variables SMTP et `ALLOWED_EMAIL_DOMAINS` dans `.env` à partir de `.env.example`. L'API refuse l'inscription si le domaine professionnel n'est pas autorisé, si le service e-mail n'est pas configuré, ou si `ALLOW_PUBLIC_REGISTRATION` n'est pas explicitement activé.
2. Créer le premier compte Laboratoire hors de l'API publique (dans le conteneur API) :

   ```powershell
   docker compose exec -e BOOTSTRAP_ADMIN_EMAIL="laboratoire@etablissement.tn" -e BOOTSTRAP_ADMIN_PASSWORD="un-mot-de-passe-d-au-moins-12-caracteres" api python -m app.bootstrap
   ```

3. Les médecins et infirmiers ouvrent l'application web, choisissent « Créer un compte » et utilisent leur adresse professionnelle autorisée.
4. Chaque utilisateur reçoit un lien personnel `/?verify=...`, confirme son adresse, puis peut se connecter. Un lien ne doit jamais être partagé entre plusieurs personnes.

Le token de vérification est stocké uniquement sous forme de hash, expire après `INVITATION_EXPIRE_HOURS` et ne peut être consommé qu'une seule fois. Aucun patient ni médecin n'est préchargé par le schéma SQL.

## Règles de fonctionnement

- Les connexions et inscriptions du frontend passent par l'API ; le rôle utilisé par l'interface est toujours celui renvoyé par le JWT, jamais celui choisi visuellement.
- L'auto-inscription est limitée aux domaines déclarés dans `ALLOWED_EMAIL_DOMAINS`. Le rôle Direction doit être créé par bootstrap ou administration et ne peut pas être choisi publiquement.
- Une PCR indétectable clôt le dossier. Une PCR détectable clôt la tâche de prélèvement mais conserve l'alerte jusqu'à l'orientation du patient.
- La file `/api/samples/pending` ne contient que les patients ayant une tâche PCR ouverte.
- Le rôle Laboratoire n'accède jamais aux routes patients. Il n'obtient que des indicateurs agrégés et une cohorte pseudonymisée (`GET /api/laboratory/cohort`) : aucun nom, adresse, téléphone, date de naissance ou numéro patient.
- Les statistiques Laboratoire suppriment les groupes dont l'effectif est inférieur à `ANALYTICS_MIN_GROUP_SIZE` (5 par défaut). Ce seuil protège contre la ré-identification indirecte, mais doit être complété par une revue de confidentialité avant production.
- Les résultats TDR/TROD et PCR exigent l'attestation explicite de leur auteur ; l'API rejette toute valeur `attested: false`.
- Les numéros patients utilisent une séquence PostgreSQL afin d'éviter les doublons en cas de créations concurrentes.

Après modification d'une base existante, la création de la séquence doit être appliquée comme migration SQL ; le script `001_schema.sql` est destiné à l'initialisation d'un volume neuf.

## Principales routes

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/patients`, `GET /api/patients/{id}`
- `POST /api/patients/{id}/risk-assessment`
- `POST /api/patients/{id}/screening-tests` (TDR ou TROD)
- `GET /api/samples/pending`, `POST /api/patients/{id}/pcr-tests`
- `POST /api/patients/{id}/orientations`
- `GET /api/dashboard/medical`, `GET /api/analytics/direction`, `GET /api/laboratory/cohort`
- `GET /api/risk-profiles`, `GET|PATCH /api/care-tasks` pour le formulaire dynamique et le suivi opérationnel.

Toutes les routes métier exigent `Authorization: Bearer <JWT>`. Les routes Laboratoire ne renvoient aucune donnée personnelle.

## Sécurité à prévoir avant production

Les données de santé exigent HTTPS, une gestion centralisée des secrets, sauvegardes chiffrées, journalisation d'accès et contrôle d'accès strict. En `ENVIRONMENT=production`, l'API refuse de démarrer avec les secrets d'exemple, un mot de passe PostgreSQL par défaut, un CORS ouvert ou une liste de domaines professionnels vide.

Avant l'ouverture aux utilisateurs : vérifier une restauration de sauvegarde, exécuter `pytest`, faire un test d'intrusion et obtenir la validation du responsable médical et de la protection des données. Aucun jeu de données de démonstration n'est créé.

Le seul profil actuellement activé est celui des usagers de drogues, configuré dans `app/profiles.py`. D'autres profils pourront être ajoutés après validation par le responsable médical.
