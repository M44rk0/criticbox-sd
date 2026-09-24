
CREATE DATABASE IF NOT EXISTS criticbox
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE criticbox;


CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(36) NOT NULL,
    tmdb_id INT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    rating DECIMAL(2, 1) NOT NULL,
    comment TEXT NULL,
    contains_spoilers TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_reviews_tmdb_id (tmdb_id),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
