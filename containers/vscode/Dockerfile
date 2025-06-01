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

# Install VS Code extensions
RUN code-server --install-extension ms-python.python \
    && code-server --install-extension ms-vscode.vscode-typescript-next \
    && code-server --install-extension ms-vscode.vscode-json \
    && code-server --install-extension redhat.java \
    && code-server --install-extension ms-vscode.cpptools \
    && code-server --install-extension golang.go \
    && code-server --install-extension rust-lang.rust-analyzer

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
