FROM codercom/code-server:latest

USER root

# Install additional tools and languages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    openjdk-17-jdk \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Go
RUN wget https://go.dev/dl/go1.21.3.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.21.3.linux-amd64.tar.gz \
    && rm go1.21.3.linux-amd64.tar.gz

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

ENV PATH="/usr/local/go/bin:/root/.cargo/bin:$PATH"

# Install VS Code extensions
RUN code-server --install-extension ms-python.python \
    && code-server --install-extension ms-vscode.vscode-typescript-next \
    && code-server --install-extension golang.go \
    && code-server --install-extension rust-lang.rust-analyzer \
    && code-server --install-extension redhat.java \
    && code-server --install-extension ms-vscode.cpptools \
    && code-server --install-extension ms-dotnettools.csharp \
    && code-server --install-extension bradlc.vscode-tailwindcss \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension ms-vscode.vscode-eslint

# Create workspace directory
RUN mkdir -p /workspace && chown -R coder:coder /workspace

USER coder
WORKDIR /workspace

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/workspace"]
