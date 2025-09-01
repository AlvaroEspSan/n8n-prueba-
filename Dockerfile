# Imagen oficial de Playwright basada en Ubuntu (con Chromium y deps)
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# 1) Paquetes base y Node (esta imagen ya trae Node 18/20 según tag)
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git tini && \
    rm -rf /var/lib/apt/lists/*

# 2) Instalar n8n globalmente
#    Si prefieres fijar versión, usa: npm i -g n8n@1.67.3
RUN npm i -g n8n

# 3) Directorios y usuario no root
ENV N8N_HOME=/home/node/.n8n
RUN mkdir -p /app/scripts "$N8N_HOME" && \
    chown -R node:node /app "$N8N_HOME"

WORKDIR /app

# 4) Dependencias JS del proyecto (Playwright ya está instalado en la imagen)
COPY package.json /app/package.json
RUN npm install --production || true

# 5) Copia tus scripts
COPY --chown=node:node scripts/ /app/scripts/

# 6) Variables por defecto (ajústalas en Railway)
ENV N8N_PORT=5678 \
    N8N_PROTOCOL=http \
    N8N_HOST=0.0.0.0 \
    WEBHOOK_TUNNEL_URL=http://localhost:5678 \
    NODE_ENV=production

USER node
EXPOSE 5678

# 7) Iniciar n8n (tini maneja señales)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["n8n"]

