FROM mcp-base:latest

USER root

# Install Swift dependencies
RUN apt-get update && apt-get install -y \
    binutils \
    libc6-dev \
    libcurl4-openssl-dev \
    libedit2 \
    libgcc-9-dev \
    libpython3.8 \
    libsqlite3-0 \
    libstdc++-9-dev \
    libxml2-dev \
    libz3-dev \
    pkg-config \
    tzdata \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Swift
RUN wget https://download.swift.org/swift-5.8.1-release/ubuntu2204/swift-5.8.1-RELEASE/swift-5.8.1-RELEASE-ubuntu22.04.tar.gz \
    && tar xzf swift-5.8.1-RELEASE-ubuntu22.04.tar.gz \
    && mv swift-5.8.1-RELEASE-ubuntu22.04 /usr/share/swift \
    && rm swift-5.8.1-RELEASE-ubuntu22.04.tar.gz

ENV PATH="/usr/share/swift/usr/bin:$PATH"

USER mcpuser
WORKDIR /workspace

# Initialize Swift package
RUN swift package init --type executable

CMD ["swift"]
