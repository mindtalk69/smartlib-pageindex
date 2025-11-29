-- Initialize pgvector extension for SmartLib Enterprise
-- This script runs automatically when PostgreSQL container starts

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Grant permissions to smartlib_admin user
GRANT ALL PRIVILEGES ON DATABASE smartlibdb TO smartlib_admin;

-- Optional: Create a schema for SmartLib if desired
-- CREATE SCHEMA IF NOT EXISTS smartlib AUTHORIZATION smartlib_admin;
