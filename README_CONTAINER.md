# KiliSocial Container Guide

This compose setup starts the current validation stack:

- Spring Boot application
- MySQL 8.0.32
- Redis 7.0

For the full deployment checklist, see `ONE_CLICK_DEPLOY.md`.

## Prepare Environment

```bash
cp .env.example .env
vi .env
chmod +x scripts/*.sh
```

If the server already runs other Docker projects, check port conflicts before starting:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
ss -lntp | grep -E '3306|6379|8080'
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

Keep MySQL and Redis bound to `127.0.0.1` unless there is a clear operational reason to expose them.

## Start

```bash
./scripts/deploy.sh
```

Equivalent command:

```bash
docker compose --env-file .env up -d --build
```

## Check Status

```bash
docker compose ps
docker inspect --format='{{.Name}} {{.State.Health.Status}}' \
  kilisocial_app kilisocial_mysql kilisocial_redis
```

All three services should be `healthy`.

## Verify App

```bash
source .env
curl -fsS "http://localhost:${APP_PORT}/actuator/health"
curl -fsS "http://localhost:${APP_PORT}/api/v1/hello"
```

## Verify MySQL Charset

```bash
source .env
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW VARIABLES LIKE 'character_set_database';"
```

Expected value:

```text
utf8mb4
```

## Verify Redis

```bash
source .env
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

Expected response:

```text
PONG
```

## Logs

```bash
./scripts/logs.sh
```

## Stop

```bash
./scripts/stop.sh
```

## Reset Data

This removes containers and local persisted data.

```bash
docker compose --env-file .env down
sudo rm -rf data/mysql data/redis
```
