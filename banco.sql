-- Criar o banco de dados
CREATE DATABASE IF NOT EXISTS carteirinhas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carteirinhas;

-- Criar a tabela de alunos
CREATE TABLE IF NOT EXISTS alunos (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(150) NOT NULL,
  matricula  VARCHAR(20)  NOT NULL UNIQUE,
  turma      VARCHAR(10)  NOT NULL,
  turno      VARCHAR(10)  NOT NULL,
  foto       VARCHAR(200),
  ano_letivo YEAR         NOT NULL DEFAULT 2025,
  impresso   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT NOW()
);

-- Criar usuário da aplicação
CREATE USER 'carteirinhas_user'@'localhost'
  IDENTIFIED BY 'SenhaForte@2025';

GRANT ALL PRIVILEGES ON carteirinhas.*
  TO 'carteirinhas_user'@'localhost';

FLUSH PRIVILEGES;
