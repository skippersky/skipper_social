# One-Click Docker Deployment

This deployment starts:

- `kilisocial_app`
- `kilisocial_mysql`
- `kilisocial_redis`

The target server can be Ubuntu 24.04 with other Docker projects running. Ports are configurable in `.env`.

## 0. First-time init (new servers)

For a brand-new Ubuntu 24.04 server, run the one-shot init script instead of the manual steps below. It installs Docker when missing, clones the repository, generates `.env` with strong random MySQL/Redis passwords, builds and starts the containers, waits for health checks, and runs smoke tests:

```bash
sudo mkdir -p /opt/kilisocial && sudo chown -R "$USER:$USER" /opt/kilisocial
git clone git@github.com:skippersky/skipper_social.git /opt/kilisocial/skipper_social
sudo bash /opt/kilisocial/skipper_social/scripts/init-deploy.sh
```

If `raw.githubusercontent.com` is reachable but SSH is not configured, you can instead download the script directly:

```bash
curl -fsSL https://raw.githubusercontent.com/skippersky/skipper_social/master/scripts/init-deploy.sh -o init-deploy.sh
sudo bash init-deploy.sh
```

After the script finishes, fill the remaining business keys in `.env` (Qwen/WA/FB/IG/TikTok) and run `./scripts/deploy.sh` once more. The sections below describe every manual step and day-2 operations.
## 1. Prepare

```bash
cp .env.example .env
vi .env
chmod +x scripts/*.sh
```

The default host ports avoid common conflicts with existing services:

```bash
APP_BIND_HOST=127.0.0.1
APP_PORT=18080
MYSQL_BIND_HOST=127.0.0.1
MYSQL_PORT=13306
REDIS_BIND_HOST=127.0.0.1
REDIS_PORT=16379
```

Bind to `0.0.0.0` only when the service must be reachable directly from outside the server. For most deployments,
keep the app behind the existing port 80/443 reverse proxy and keep MySQL/Redis on `127.0.0.1`.

## 2. Start

```bash
./scripts/deploy.sh
```

Equivalent command:

```bash
docker compose --env-file .env up -d --build
```

## 3. Check Status

```bash
docker compose ps
docker inspect --format='{{.Name}} {{.State.Health.Status}}' \
  kilisocial_app kilisocial_mysql kilisocial_redis
```

Expected:

```text
/kilisocial_app healthy
/kilisocial_mysql healthy
/kilisocial_redis healthy
```

## 4. Smoke Test

```bash
source .env
curl -fsS "http://localhost:${APP_PORT}/actuator/health"
curl -fsS "http://localhost:${APP_PORT}/api/v1/hello"
```

If Nginx or another reverse proxy already owns ports `80` and `443`, route public traffic to:

```text
http://127.0.0.1:18080
```

## 5. Logs

```bash
./scripts/logs.sh
```

## 6. Stop

```bash
./scripts/stop.sh
```

## 7. Reset Data

This removes containers and persisted MySQL/Redis data.

```bash
docker compose --env-file .env down
sudo rm -rf data/mysql data/redis
```

## Notes

- JVM memory is controlled by `JAVA_OPTS`; the default is `-Xms256m -Xmx768m`.
- The current application image is built locally from source and does not push to any registry.
- MySQL and Redis are still available to the host through configurable mapped ports.
