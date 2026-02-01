#!/bin/bash
set -e

echo "🐳 Building Dashbook Docker image..."

# Build image
docker build -t dashbook:latest .

echo "✅ Build complete!"
echo ""
echo "Run locally:"
echo "  docker run -p 8080:8080 dashbook:latest"
echo ""
echo "Or with docker-compose:"
echo "  docker-compose up"
