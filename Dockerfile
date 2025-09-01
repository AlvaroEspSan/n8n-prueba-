# Node >= 20.19 (vamos con 22 LTS)
FROM node:22-bookworm-slim

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git curl wget tini && \
    rm -rf /var/lib/apt/lists/*

# Instala n8n compatible
RUN npm i -g n8n@latest

WORKDIR /app

# Dependencias de tu proyecto (opcional)
COPY package.json /app/package.json
RUN npm install --production || true

# Instala Playwright + Chromium y TODAS sus dependencias del SO
RUN npx playwright install --with-deps chromium

# Copia tus scripts y asigna permisos al usuario 'node'
RUN mkdir -p /app/scripts && chown -R node:node /app
COPY --chown=node:node scripts/ /app/scripts/

# Vars por defecto (ajústalas en Railway)
ENV N8N_PORT=5678 \
    N8N_HOST=0.0.0.0 \
    N8N_PROTOCOL=http \
    WEBHOOK_TUNNEL_URL=http://localhost:5678 \
    NODE_ENV=production

USER node
EXPOSE 5678
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["n8n"]


