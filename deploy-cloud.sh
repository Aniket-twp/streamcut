#!/usr/bin/env bash
set -e

echo "🚀 Deploying StreamCut to Cloud..."

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "📦 Installing docker compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 2. Build and start containers in the background
echo "🔨 Building StreamCut Cloud Container..."
docker compose build

echo "⚡ Starting StreamCut Cloud Daemon..."
docker compose up -d

echo "✅ StreamCut Cloud is LIVE!"
IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "your-server-ip")
echo "🌐 Open your StreamCut cloud dashboard at: http://${IP}:5173"
