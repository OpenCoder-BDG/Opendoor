FROM mcp-base:latest

USER root

# Install Lua and LuaRocks
RUN apt-get update && apt-get install -y \
    lua5.4 \
    luarocks \
    && rm -rf /var/lib/apt/lists/*

# Install common Lua modules
RUN luarocks install luasocket
RUN luarocks install luajson
RUN luarocks install penlight

USER mcpuser
WORKDIR /workspace

CMD ["lua"]
