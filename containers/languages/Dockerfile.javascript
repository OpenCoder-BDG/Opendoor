FROM mcp-base:latest

USER root

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install global packages
RUN npm install -g \
    typescript \
    ts-node \
    @types/node \
    nodemon \
    pm2 \
    express \
    lodash \
    axios \
    moment \
    uuid \
    jest \
    webpack \
    webpack-cli \
    babel-cli \
    @babel/core \
    @babel/preset-env

USER mcpuser
WORKDIR /workspace

# Initialize npm project
RUN npm init -y

CMD ["node"]
