-- Migration sécurité + inscription
-- MySQL

ALTER TABLE inscriptions
  MODIFY filiere_id INT NULL;

ALTER TABLE inscriptions
  ADD COLUMN filiere_autre VARCHAR(150) NULL AFTER filiere_id;

-- Indexes recommandés pour filtres dashboard
CREATE INDEX idx_inscriptions_created_at ON inscriptions(created_at);
CREATE INDEX idx_inscriptions_type ON inscriptions(type_universite);
CREATE INDEX idx_inscriptions_universite_id ON inscriptions(universite_id);
CREATE INDEX idx_inscriptions_filiere_id ON inscriptions(filiere_id);

