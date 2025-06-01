FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Install additional tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18 from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Playwright for Python and Node.js
RUN pip install playwright beautifulsoup4 requests
RUN npm install -g playwright @playwright/test

# Install browsers
RUN playwright install chromium firefox webkit

# Create workspace and user
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser
RUN mkdir -p /workspace && chown mcpuser:mcpuser /workspace

USER mcpuser
WORKDIR /workspace

# Keep container running with browser available
CMD ["tail", "-f", "/dev/null"]
