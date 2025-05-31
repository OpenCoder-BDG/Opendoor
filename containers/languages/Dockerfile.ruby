FROM mcp-base:latest

USER root

# Install Ruby and bundler
RUN apt-get update && apt-get install -y \
    ruby \
    ruby-dev \
    bundler \
    && rm -rf /var/lib/apt/lists/*

# Install common gems
RUN gem install \
    rails \
    sinatra \
    json \
    httparty \
    nokogiri \
    rspec

USER mcpuser
WORKDIR /workspace

# Initialize Bundler project
RUN bundle init

CMD ["ruby"]
