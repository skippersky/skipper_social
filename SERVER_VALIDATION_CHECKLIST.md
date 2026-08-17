# Server Validation Checklist

Run this checklist on the deployment server where Docker, MySQL, Redis, and the Spring Boot app are available.

## 1. Start Infrastructure

```bash
cp .env.example .env
vi .env
docker compose up -d
```

Confirm both containers are healthy:

```bash
docker ps --filter "name=kilisocial_mysql" --filter "name=kilisocial_redis"
docker inspect --format='{{.Name}} {{.State.Health.Status}}' kilisocial_mysql kilisocial_redis
```

Expected:

```text
/kilisocial_mysql healthy
/kilisocial_redis healthy
```

## 2. Verify MySQL utf8mb4

```bash
source .env
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW VARIABLES LIKE 'character_set_database';"
```

Expected value:

```text
utf8mb4
```

## 3. Confirm Flyway Migration

After the Spring Boot application starts with Flyway enabled, confirm the migration table and prompt table exist:

```bash
source .env
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" \
  -e "SHOW TABLES LIKE 'flyway_schema_history'; SHOW TABLES LIKE 'prompt_config';"
```

Confirm `V1__create_prompt_config.sql` succeeded:

```bash
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" \
  -e "SELECT version, description, success FROM flyway_schema_history WHERE version = '1';"
```

Expected:

```text
success = 1
```

## 4. Spring Boot API Smoke Test

Start the application using the server deployment method, then run:

```bash
curl -fsS http://localhost:8080/api/v1/hello
curl -fsS "http://localhost:8080/api/v1/hello?locale=sw"
```

Expected:

```json
{"success":true,"code":"OK","message":"success"}
```

## 5. Verify Redis Connectivity

```bash
source .env
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

Expected:

```text
PONG
```

## 6. Verify Semantic Cache Write

Use the same key format as `ai-service`:

```bash
source .env
CACHE_KEY="qwen:cache:qwen-turbo:a94eb709fb27abb1097000cbd3a43d5ba95444dcc70a5c670f3a2a8c4808e58c"
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" setex "${CACHE_KEY}" 86400 "cached copy"
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" get "${CACHE_KEY}"
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ttl "${CACHE_KEY}"
```

Expected:

```text
cached copy
```

The TTL should be greater than `0` and no more than `86400`.
