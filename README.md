# KiliSocial Backend

Spring Boot 3 backend scaffold for the KiliSocial MVP.

## Requirements

- JDK 17
- Maven 3.9+

## Local Commands

```powershell
mvn validate
mvn test
mvn spring-boot:run
```

Smoke-test endpoint:

```text
GET http://localhost:8080/api/v1/hello
GET http://localhost:8080/api/v1/hello?locale=sw
```
