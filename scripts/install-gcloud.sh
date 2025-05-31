#!/bin/bash

# Install Google Cloud CLI and authenticate
set -e

echo "Installing Google Cloud CLI..."

# Install gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "Installing Google Cloud CLI..."
    curl -sSL https://sdk.cloud.google.com | bash
    exec -l $SHELL
    gcloud version
else
    echo "Google Cloud CLI already installed"
    gcloud version
fi

# Authenticate with service account
echo "Authenticating with service account..."
gcloud auth activate-service-account --key-file=infrastructure/gcp-credentials.json

# Set project
echo "Setting project..."
gcloud config set project capable-acrobat-460705-t1

# Configure Docker authentication
echo "Configuring Docker authentication..."
gcloud auth configure-docker us-central1-docker.pkg.dev

echo "Google Cloud CLI setup complete!"
echo "Project: $(gcloud config get-value project)"
echo "Account: $(gcloud config get-value account)"
