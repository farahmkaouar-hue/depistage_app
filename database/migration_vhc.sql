-- Migration VHC : ajouter les champs du nouveau parcours patient.
-- Sauvegarder la base avant exécution.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS maiden_name VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(4);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS anonymized_code VARCHAR(19);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_first_use DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_last_use DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_last_risk_exposure DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_sharing VARCHAR(3);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS previous_sharing VARCHAR(3);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS frequency VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS route VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_anonymized_code ON patients(anonymized_code) WHERE anonymized_code IS NOT NULL;

-- Pour les nouveaux dossiers, l'API impose toutes ces valeurs.
-- Les anciennes lignes restent lisibles jusqu'à leur mise à jour.
-- Après avoir complété les anciennes lignes, vous pouvez renforcer la base avec :
-- ALTER TABLE patients ALTER COLUMN address SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN governorate SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN postal_code SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN anonymized_code SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN date_first_use SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN date_last_use SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN date_last_risk_exposure SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN current_sharing SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN previous_sharing SET NOT NULL;
