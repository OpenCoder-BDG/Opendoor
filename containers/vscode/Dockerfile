FROM codercom/code-server:latest

USER root

# Install additional development tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    python3 \
    python3-pip \
    nodejs \
    npm \
    openjdk-17-jdk \
    maven \
    gradle \
    && rm -rf /var/lib/apt/lists/*

# Install VS Code extensions (install individually to prevent failures)
RUN code-server --install-extension ms-python.python || true
RUN code-server --install-extension ms-vscode.vscode-typescript-next || true  
RUN code-server --install-extension redhat.java || true
RUN code-server --install-extension ms-vscode.cpptools-extension-pack || true
RUN code-server --install-extension golang.go || true
RUN code-server --install-extension rust-lang.rust-analyzer || true

# Configure VS Code settings
RUN mkdir -p /home/coder/.local/share/code-server/User
COPY settings.json /home/coder/.local/share/code-server/User/

# Set workspace permissions
RUN mkdir -p /workspace && \
    chown -R coder:coder /workspace /home/coder

USER coder

WORKDIR /workspace

# Expose VS Code server port
EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/workspace"]
