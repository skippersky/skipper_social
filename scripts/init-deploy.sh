#!/usr/bin/env bash
# KiliSocial one-click init deployment for Ubuntu 24.04 servers.
#
# Usage:
#   bash scripts/init-deploy.sh
#
# Overridable variables:
#   REPO_URL    git repository to deploy (default: public GitHub mirror)
#   REPO_BRANCH branch to deploy (default: master)
#   INSTALL_DIR target directory (default: /opt/kilisocial)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/skippersky/skipper_social.git}"
REPO_BRANCH="${REPO_BRANCH:-master}"
INSTALL_DIR="${INSTALL_DIR:-/opt/kilisocial}"
APP_DIR="${INSTALL_DIR}/skipper_social"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-240}"

log() { echo "[init-deploy] $*"; }
die() { echo "[init-deploy][ERROR] $*" >&2; exit 1; }

# ---------- 0. root ----------
if [ "$(id -u)" -ne 0 ]; then
  log "not root; re-running with sudo"
  exec sudo -E bash "$0" "$@"
fi

# ---------- 1. base packages ----------
log "checking base packages (git, curl, ca-certificates)"
apt-get update -y >/dev/null
apt-get install -y git curl ca-certificates gnupg >/dev/null

# ---------- 2. docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker Engine + Compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y >/dev/null
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null
docker compose version >/dev/null 2>&1 || die "docker compose plugin is unavailable"
log "docker ready: $(docker --version), $(docker compose version)"

# ---------- 3. source code ----------
if [ -d "${APP_DIR}/.git" ]; then
  log "updating existing checkout at ${APP_DIR}"
  git -C "${APP_DIR}" checkout "${REPO_BRANCH}" 2>/dev/null || true
  if git -C "${APP_DIR}" pull --ff-only; then
    log "checkout updated to latest ${REPO_BRANCH}"
  else
    log "WARNING: pull failed (network/credentials); deploying the existing checkout as-is"
  fi
elif [ -e "${APP_DIR}" ]; then
  die "${APP_DIR} exists but is not a git checkout"
else
  log "cloning ${REPO_URL} (${REPO_BRANCH}) into ${APP_DIR}"
  mkdir -p "${INSTALL_DIR}"
  git clone --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"
[ -f docker-compose.yml ] || die "docker-compose.yml not found in ${APP_DIR}"

# ---------- 4. env file ----------
if [ ! -f .env ]; then
  cp .env.example .env
  log "created .env from .env.example"
fi
gen_secret() { openssl rand -hex 16; }
if grep -q '^MYSQL_ROOT_PASSWORD=change_me' .env; then
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(gen_secret)|" .env
  log "generated a strong MYSQL_ROOT_PASSWORD"
fi
if grep -q '^REDIS_PASSWORD=change_me' .env; then
  sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(gen_secret)|" .env
  log "generated a strong REDIS_PASSWORD"
fi
if grep -q 'change_me' .env; then
  log "WARNING: .env still contains change_me_* values (Qwen/WA/social APIs). Edit .env before real integration tests."
fi

# ---------- 5. port conflict check ----------
set +e
CONFLICT=0
while read -r p; do
  if ss -ltn 2>/dev/null | grep -qE "[:.]${p}[[:space:]]"; then
    log "WARNING: host port ${p} is already in use; adjust .env (APP_PORT/MYSQL_PORT/REDIS_PORT) if needed"
    CONFLICT=1
  fi
done <<EOF
$(grep -E '^(APP_PORT|MYSQL_PORT|REDIS_PORT)=' .env | cut -d= -f2)
EOF
[ "${CONFLICT}" -eq 0 ] && log "no port conflicts detected"
set -e

# ---------- 6. build and start ----------
chmod +x scripts/*.sh 2>/dev/null || true
log "building images and starting containers (first run downloads Maven dependencies and may take a while)"
docker compose --env-file .env up -d --build

# ---------- 7. wait for healthy ----------
log "waiting for containers to become healthy (timeout ${HEALTH_TIMEOUT_SECONDS}s)"
elapsed=0
while [ "${elapsed}" -lt "${HEALTH_TIMEOUT_SECONDS}" ]; do
  ok=1
  for name in kilisocial_app kilisocial_mysql kilisocial_redis; do
    status="$(docker inspect --format='{{.State.Health.Status}}' "${name}" 2>/dev/null || echo starting)"
    [ "${status}" = "healthy" ] || { ok=0; break; }
  done
  [ "${ok}" -eq 1 ] && break
  sleep 5
  elapsed=$((elapsed + 5))
done
docker compose --env-file .env ps
for name in kilisocial_app kilisocial_mysql kilisocial_redis; do
  log "${name} -> $(docker inspect --format='{{.State.Health.Status}}' "${name}" 2>/dev/null || echo missing)"
done
[ "${ok}" -eq 1 ] || die "containers did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s; check: docker compose logs app"

# ---------- 8. smoke test ----------
APP_PORT="$(grep -E '^APP_PORT=' .env | cut -d= -f2)"
APP_PORT="${APP_PORT:-18080}"
log "smoke testing http://127.0.0.1:${APP_PORT}"
curl -fsS "http://127.0.0.1:${APP_PORT}/actuator/health" && echo
curl -fsS "http://127.0.0.1:${APP_PORT}/api/v1/hello" && echo

log "deployment finished. App listens on 127.0.0.1:${APP_PORT}; point your reverse proxy there."