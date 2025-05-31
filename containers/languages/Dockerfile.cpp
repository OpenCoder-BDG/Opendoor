FROM mcp-base:latest

USER root

# Install G++ and build tools
RUN apt-get update && apt-get install -y \
    g++ \
    gcc \
    gdb \
    make \
    cmake \
    valgrind \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

USER mcpuser
WORKDIR /workspace

CMD ["g++"]
