FROM mcp-base:latest

USER root

# Install PHP and common extensions
RUN apt-get update && apt-get install -y \
    php8.1 \
    php8.1-cli \
    php8.1-common \
    php8.1-curl \
    php8.1-json \
    php8.1-mbstring \
    php8.1-xml \
    php8.1-zip \
    composer \
    && rm -rf /var/lib/apt/lists/*

USER mcpuser
WORKDIR /workspace

# Initialize Composer project
RUN composer init --no-interaction

CMD ["php"]
