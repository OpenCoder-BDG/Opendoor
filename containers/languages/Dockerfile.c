FROM mcp-base:latest

USER root

# Install GCC and build tools
RUN apt-get update && apt-get install -y \
    gcc \
    gdb \
    make \
    cmake \
    valgrind \
    && rm -rf /var/lib/apt/lists/*

USER mcpuser
WORKDIR /workspace

CMD ["gcc"]
