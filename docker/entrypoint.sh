#!/bin/sh
set -e

echo "Running database migrations..."
bun run db:migrate

echo "Starting BlockBot API..."
exec bun run src/index.ts
