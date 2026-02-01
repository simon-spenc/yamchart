#!/bin/bash
set -e

echo "🚀 Deploying Dashbook to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Install it: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Run: fly auth login"
    exit 1
fi

# Check if app exists, create if not
if ! fly apps list | grep -q "dashbook"; then
    echo "📦 Creating Fly.io app..."
    fly apps create dashbook

    # Create volume for DuckDB persistence
    echo "💾 Creating persistent volume..."
    fly volumes create dashbook_data --region sjc --size 1
fi

# Deploy
echo "🏗️  Building and deploying..."
fly deploy

echo "✅ Deployment complete!"
echo "🌐 Visit: https://dashbook.fly.dev"
