-- Base de données plateforme orientation universitaire
CREATE DATABASE IF NOT EXISTS shoolapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shoolapp;

-- Administrateurs
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Types d'université
-- type: 'publique' | 'privee'

-- Filières (référentiel)
CREATE TABLE IF NOT EXISTS filieres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL UNIQUE,
  slug VARCHAR(150) NOT NULL UNIQUE,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  grand_groupe VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sous-filières (rattachées à une filière)
CREATE TABLE IF NOT EXISTS sous_filieres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filiere_id INT NOT NULL,
  nom VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sous_filiere_parent_slug (filiere_id, slug),
  FOREIGN KEY (filiere_id) REFERENCES filieres(id) ON DELETE CASCADE
);

-- Universités
CREATE TABLE IF NOT EXISTS universites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  type ENUM('publique', 'privee') NOT NULL,
  ville VARCHAR(100) NOT NULL,
  description TEXT,
  logo VARCHAR(255),
  brochure VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Photos des universités
CREATE TABLE IF NOT EXISTS universite_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  universite_id INT NOT NULL,
  fichier VARCHAR(255) NOT NULL,
  ordre INT DEFAULT 0,
  FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE
);

-- Campus (implantations géographiques)
CREATE TABLE IF NOT EXISTS campuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  universite_id INT NOT NULL,
  nom VARCHAR(200) NOT NULL,
  ville VARCHAR(120) NOT NULL,
  adresse TEXT,
  latitude DOUBLE,
  longitude DOUBLE,
  ordre INT DEFAULT 0,
  FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE
);

-- Filières proposées par chaque université (table de liaison)
CREATE TABLE IF NOT EXISTS universite_filieres (
  universite_id INT NOT NULL,
  filiere_id INT NOT NULL,
  offre_filiere_entiere TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = toute la filière, 0 = sélection par spécialités',
  PRIMARY KEY (universite_id, filiere_id),
  FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE,
  FOREIGN KEY (filiere_id) REFERENCES filieres(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS universite_sous_filieres (
  universite_id INT NOT NULL,
  sous_filiere_id INT NOT NULL,
  PRIMARY KEY (universite_id, sous_filiere_id),
  FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE,
  FOREIGN KEY (sous_filiere_id) REFERENCES sous_filieres(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS universite_specialites_libelle (
  universite_id INT NOT NULL,
  filiere_id INT NOT NULL,
  libelle VARCHAR(190) NOT NULL,
  PRIMARY KEY (universite_id, filiere_id, libelle),
  FOREIGN KEY (universite_id) REFERENCES universites(id) ON DELETE CASCADE,
  FOREIGN KEY (filiere_id) REFERENCES filieres(id) ON DELETE CASCADE
);

-- Demandes d'inscription (candidats)
CREATE TABLE IF NOT EXISTS inscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  date_naissance DATE NOT NULL,
  sexe ENUM('M', 'F') NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  niveau_etude VARCHAR(100),
  serie_bac VARCHAR(50),
  annee_bac VARCHAR(10),
  filiere_id INT NULL,
  filiere_autre VARCHAR(150),
  universite_id INT NOT NULL,
  type_universite ENUM('publique', 'privee') NOT NULL,
  pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI' COMMENT 'Bureau FIGS: CI=Côte d''Ivoire, BF=Burkina Faso',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (filiere_id) REFERENCES filieres(id),
  FOREIGN KEY (universite_id) REFERENCES universites(id)
);

CREATE TABLE IF NOT EXISTS rendez_vous (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI',
  type_rdv VARCHAR(50) NOT NULL,
  date_souhaitee DATE NOT NULL,
  creneau VARCHAR(40) NOT NULL,
  message TEXT,
  statut ENUM('nouveau', 'a_confirmer', 'confirme', 'annule', 'termine') NOT NULL DEFAULT 'nouveau',
  notes_internes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rdv_statut (statut),
  INDEX idx_rdv_date_souhaitee (date_souhaitee)
);

CREATE TABLE IF NOT EXISTS demandes_orientation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  pays_bureau ENUM('CI', 'BF') NOT NULL DEFAULT 'CI',
  grande_filiere VARCHAR(200) NOT NULL,
  specialite VARCHAR(400) NOT NULL,
  besoin_orientation TINYINT(1) NOT NULL DEFAULT 1,
  message TEXT,
  statut ENUM('nouveau', 'validee', 'traitee', 'annulee') NOT NULL DEFAULT 'nouveau',
  notes_internes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_do_statut (statut),
  INDEX idx_do_created (created_at)
);

-- Données initiales: 10 filières
INSERT INTO filieres (nom, slug) VALUES
('Médecine', 'medecine'),
('Informatique', 'informatique'),
('Droit', 'droit'),
('Gestion', 'gestion'),
('Marketing', 'marketing'),
('Génie civil', 'genie-civil'),
('Finance', 'finance'),
('Communication', 'communication'),
('Architecture', 'architecture'),
('Psychologie', 'psychologie');

-- Admin par défaut: exécuter database/seed-admin.js pour créer (mot de passe: admin123)
