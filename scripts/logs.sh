#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file .env logs -f --tail=200 app
