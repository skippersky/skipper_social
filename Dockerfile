FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY . .
RUN mvn -s .mvn/settings.xml -DskipTests package

FROM eclipse-temurin:17-jre

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/target/kili-social-0.0.1-SNAPSHOT.jar /app/kili-social.jar
COPY --from=build /workspace/ai-service/target/ai-service-0.0.1-SNAPSHOT.jar /app/libs/ai-service.jar
COPY --from=build /workspace/wa-webhook-controller/target/wa-webhook-controller-0.0.1-SNAPSHOT.jar /app/libs/wa-webhook-controller.jar
COPY --from=build /workspace/copywriting-service/target/copywriting-service-0.0.1-SNAPSHOT.jar /app/libs/copywriting-service.jar
COPY --from=build /workspace/wa-ai-integration/target/wa-ai-integration-0.0.1-SNAPSHOT.jar /app/libs/wa-ai-integration.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dloader.path=/app/libs -cp /app/kili-social.jar org.springframework.boot.loader.launch.PropertiesLauncher"]
