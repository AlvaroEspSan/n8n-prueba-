# Imagen oficial de Playwright (Ubuntu 22.04) con Chromium y deps ya listas
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# Paquetes base y n8n
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git tini && \
    rm -rf /var/lib/apt/lists/*

# Instalar n8n (fija versión si quieres)
RUN npm i -g n8n@1.67.3

# Directorios y permisos: usa pwuser/pwuser (NO node:node)
ENV N8N_HOME=/home/pwuser/.n8n
RUN mkdir -p /app/scripts "$N8N_HOME" && \
    chown -R pwuser:pwuser /app "$N8N_HOME"

WORKDIR /app

# Dependencias del proyecto (opcional; la imagen ya trae Playwright)
COPY package.json /app/package.json
RUN npm install --production || true

# Copia tus scripts con el owner correcto
COPY --chown=pwuser:pwuser scripts/ /app/scripts/

# Variables por defecto (ajusta en Railway)
ENV N8N_PORT=5678 \
    N8N_PROTOCOL=http \
    N8N_HOST=0.0.0.0 \
    WEBHOOK_TUNNEL_URL=http://localhost:5678 \
    NODE_ENV=production

USER pwuser
EXPOSE 5678

# Inicia n8n con tini
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["n8n"]


