#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from .env.example. Edit .env first, then rerun: ./scripts/deploy.sh"
  exit 1
fi

docker compose --env-file .env up -d --build
docker compose ps
