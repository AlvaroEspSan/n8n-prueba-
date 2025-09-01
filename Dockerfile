# Imagen Playwright (Ubuntu) con Chromium ya listo
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git tini && \
    rm -rf /var/lib/apt/lists/*

# ✅ Instala una versión válida de n8n
# Opción A: siempre la última estable
RUN npm i -g n8n@latest
# Opción B (si quieres quedarte en la rama 1.x): 
# RUN npm i -g "n8n@^1"

# Prepara directorios usando el usuario correcto de esta imagen: pwuser
ENV N8N_HOME=/home/pwuser/.n8n
RUN mkdir -p /app/scripts "$N8N_HOME" && \
    chown -R pwuser:pwuser /app "$N8N_HOME"

WORKDIR /app

# (Opcional) dependencias de tu proyecto
COPY package.json /app/package.json
RUN npm install --production || true

# Copia tus scripts
COPY --chown=pwuser:pwuser scripts/ /app/scripts/

# Variables base (ajústalas en Railway)
ENV N8N_PORT=5678 \
    N8N_PROTOCOL=http \
    N8N_HOST=0.0.0.0 \
    WEBHOOK_TUNNEL_URL=http://localhost:5678 \
    NODE_ENV=production

USER pwuser
EXPOSE 5678
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["n8n"]



