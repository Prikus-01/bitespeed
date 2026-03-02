-- Bitespeed Identity Reconciliation Schema
-- Creates the Contact table and supporting structures

-- Create ENUM type for link precedence
CREATE TYPE link_precedence AS ENUM ('primary', 'secondary');

-- Create Contact table
CREATE TABLE IF NOT EXISTS contact (
    id           SERIAL PRIMARY KEY,
    "phoneNumber" VARCHAR(50),
    email        VARCHAR(255),
    "linkedId"   INTEGER REFERENCES contact(id) ON DELETE SET NULL,
    "linkPrecedence" link_precedence NOT NULL DEFAULT 'primary',
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt"  TIMESTAMPTZ
);

-- Auto-update updatedAt trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to contact table
DROP TRIGGER IF EXISTS update_contact_updated_at ON contact;
CREATE TRIGGER update_contact_updated_at
    BEFORE UPDATE ON contact
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

