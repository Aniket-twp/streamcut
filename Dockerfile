# Multi-stage production container for StreamCut Cloud
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies: ffmpeg, yt-dlp, python3 for Whisper transcription
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set up python venv for faster-whisper
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir faster-whisper

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
ENV LAN=1
ENV STREAMCUT_PYTHON=/app/.venv/bin/python

COPY --from=builder /app /app

EXPOSE 5173

# No VOLUME directive here on purpose. Railway rejects any Dockerfile containing
# VOLUME ("docker VOLUME ... is not supported, use Railway Volumes"), which is
# what failed every deploy of this repo. Persistence is declared by the consumer
# instead: docker-compose.yml mounts named volumes at these same paths, and on
# Railway you attach a Volume to the service in the dashboard or via
# `railway volume add`.
# Data dirs the app writes to: /app/storage, /app/cache

CMD ["node", "server.mjs", "--lan"]
