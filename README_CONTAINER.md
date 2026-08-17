# KiliSocial Container Guide

This compose setup starts only the Sprint 0 infrastructure services:

- MySQL 8.0.32
- Redis 7.0

No application service is included.

## Prepare Environment

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace all `change_me_*` values before starting services.

## Start

```powershell
docker compose up -d
```

## Check Status

```powershell
docker ps
```

Both `kilisocial_mysql` and `kilisocial_redis` should show `healthy`.

## Verify MySQL Charset

```powershell
docker compose exec mysql mysql -u root -p"$env:MYSQL_ROOT_PASSWORD" -e "SHOW VARIABLES LIKE 'character_set_database';"
```

Expected value:

```text
utf8mb4
```

## Verify Redis

```powershell
docker compose exec redis redis-cli -a "$env:REDIS_PASSWORD" ping
```

Expected response:

```text
PONG
```

## Stop

```powershell
docker compose down
```

## Reset Local Data

This removes containers and local persisted data.

```powershell
docker compose down
Remove-Item -Recurse -Force .\data\mysql, .\data\redis
```
