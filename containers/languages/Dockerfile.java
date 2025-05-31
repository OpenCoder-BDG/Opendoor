FROM mcp-base:latest

USER root

# Install OpenJDK and Maven
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    maven \
    gradle \
    && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

USER mcpuser
WORKDIR /workspace

# Create basic Java project structure
RUN mkdir -p src/main/java src/test/java

CMD ["java"]
