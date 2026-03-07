CREATE DATABASE IF NOT EXISTS hackathon_db;

USE hackathon_db;

CREATE TABLE IF NOT EXISTS registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE,
  team_name VARCHAR(255),
  domain VARCHAR(255),
  branch VARCHAR(255),

  team_lead_name VARCHAR(255),
  team_lead_email VARCHAR(255),
  team_lead_phone VARCHAR(20),

  member1_name VARCHAR(255),
  member1_email VARCHAR(255),
  member1_phone VARCHAR(20),

  member2_name VARCHAR(255),
  member2_email VARCHAR(255),
  member2_phone VARCHAR(20),

  member3_name VARCHAR(255),
  member3_email VARCHAR(255),
  member3_phone VARCHAR(20),

  member4_name VARCHAR(255),
  member4_email VARCHAR(255),
  member4_phone VARCHAR(20),

  utr VARCHAR(50),
  transaction_id VARCHAR(100),
  payment_status VARCHAR(50),
  image_hash VARCHAR(128),
  ai_confidence DECIMAL(5,2),
  verification_details JSON,
  payment_screenshot VARCHAR(500),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to track used UTRs for duplicate detection
CREATE TABLE IF NOT EXISTS used_utrs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utr VARCHAR(50) UNIQUE NOT NULL,
  order_id VARCHAR(100),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to track used image hashes for screenshot reuse detection
CREATE TABLE IF NOT EXISTS used_image_hashes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_hash VARCHAR(128) UNIQUE NOT NULL,
  order_id VARCHAR(100),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to log all verification attempts (audit trail)
CREATE TABLE IF NOT EXISTS verification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(100),
  utr_submitted VARCHAR(50),
  ip_address VARCHAR(45),
  result ENUM('approved', 'rejected') NOT NULL,
  failure_reasons TEXT,
  ai_confidence DECIMAL(5,2),
  ocr_extracted_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
