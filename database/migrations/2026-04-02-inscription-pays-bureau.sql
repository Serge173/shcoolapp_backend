-- Bureau FIGS d’origine de la candidature (Côte d’Ivoire / Burkina Faso)
-- À exécuter une fois sur MySQL (Render / prod) avant le redéploiement backend.
ALTER TABLE inscriptions
  ADD COLUMN pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI';

CREATE INDEX idx_inscriptions_pays_bureau ON inscriptions(pays_bureau);
