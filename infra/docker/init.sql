-- MyAthan Database Initialization
-- This runs on first database creation only

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for common queries (Drizzle handles table creation)
-- These are created after Drizzle pushes the schema

-- Note: Run `npm run db:push --workspace=apps/api` after database creation
-- to create tables via Drizzle ORM schema
