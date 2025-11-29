#!/bin/bash
# Enable pgvector extension in PostgreSQL
# Run this after starting docker-compose.enterprise.yaml

echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "Enabling pgvector extension..."
docker exec smartlib-postgres-1 psql -U smartlib_admin -d smartlibdb -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Verifying pgvector installation..."
docker exec smartlib-postgres-1 psql -U smartlib_admin -d smartlibdb -c "\dx vector"

echo "✅ Done! pgvector extension is enabled."
