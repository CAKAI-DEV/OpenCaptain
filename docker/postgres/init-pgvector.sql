-- Enable pgvector extension for vector similarity search
-- This runs on first database creation, before any Drizzle migrations
-- The pgvector/pgvector:pg16 Docker image has the extension pre-installed
-- but this ensures it's enabled in the database

CREATE EXTENSION IF NOT EXISTS vector;
