FROM mcp-base:latest

USER root

# Install Perl and CPAN modules
RUN apt-get update && apt-get install -y \
    perl \
    cpanminus \
    && rm -rf /var/lib/apt/lists/*

# Install common Perl modules
RUN cpanm --notest \
    LWP::UserAgent \
    JSON \
    DBI \
    Moose \
    DateTime \
    File::Slurp

USER mcpuser
WORKDIR /workspace

CMD ["perl"]
