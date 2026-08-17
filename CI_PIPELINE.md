# CI Pipeline

GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

## Trigger

- Push to `main`
- Push to `develop`
- Pull request to `main`

## Gates

```bash
mvn -B verify
```

This runs Checkstyle, unit tests, and JaCoCo coverage checks. The Maven build fails when tests fail or line coverage is below 80%, blocking merge.

## Docker Build

The workflow builds a CI-only image with:

```bash
docker build -f Dockerfile.ci -t kilisocial-app:${GITHUB_SHA} .
```

The image is not pushed.

## Artifacts

The workflow uploads:

- built jar files
- JaCoCo XML reports
- `SERVER_VALIDATION_CHECKLIST.md`

## Secrets

The workflow references sensitive values only through GitHub Secrets:

- `QWEN_API_KEY`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `REDIS_PASSWORD`
- `DINGTALK_WEBHOOK_URL`
- `FAILURE_EMAIL_TO`

No secret values are stored in the repository.
