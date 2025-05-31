FROM mcp-base:latest

USER root

# Install Go
RUN wget https://go.dev/dl/go1.21.3.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.21.3.linux-amd64.tar.gz \
    && rm go1.21.3.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:$PATH"
ENV GOPATH="/home/mcpuser/go"
ENV PATH="$GOPATH/bin:$PATH"

# Install common Go tools
RUN go install golang.org/x/tools/gopls@latest \
    && go install github.com/air-verse/air@latest \
    && go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

USER mcpuser
WORKDIR /workspace

# Initialize Go module
RUN go mod init workspace

CMD ["go", "run"]
