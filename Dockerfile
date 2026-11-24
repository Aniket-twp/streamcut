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

# HOST/LAN only. Deliberately NOT setting PORT or EXPOSE here: Railway injects
# its own PORT (8080 on this service), and pinning 5173 in the image made the
# domain's target port 5173 while the app actually listened on 8080 — every
# public request 502'd even though the internal healthcheck passed. Local dev
# and docker-compose still get 5173 (server.mjs default / compose env).
ENV HOST=0.0.0.0
ENV LAN=1
ENV STREAMCUT_PYTHON=/app/.venv/bin/python

COPY --from=builder /app /app

# Data dirs the app writes to: /app/storage, /app/cache

CMD ["node", "server.mjs", "--lan"]
