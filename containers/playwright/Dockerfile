FROM mcr.microsoft.com/playwright:v1.40.0-focal

USER root

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python Playwright
RUN pip3 install playwright pytest-playwright requests beautifulsoup4

# Install Node.js Playwright
RUN npm install -g playwright @playwright/test

# Install browsers
RUN playwright install chromium firefox webkit
RUN npx playwright install chromium firefox webkit

# Create workspace
RUN mkdir -p /workspace && chown -R pwuser:pwuser /workspace

USER pwuser
WORKDIR /workspace

# Create sample scripts
COPY --chown=pwuser:pwuser playwright-examples/ /workspace/examples/

EXPOSE 9222

CMD ["python3", "-m", "http.server", "9222"]
