# Imagen base oficial de n8n (Debian-based)
FROM n8nio/n8n:latest

# Cambia a root para instalar dependencias del sistema
USER root

# Dependencias que requiere Chromium/Playwright en Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Instalar Playwright (con Chromium) en la misma imagen
# n8n ya trae Node, así que solo añadimos dependencias JS
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --production
# Descarga binarios del navegador y libs del SO que falten
RUN npx playwright install --with-deps chromium

# Copia tus scripts a una ruta conocida dentro del contenedor
COPY scripts /app/scripts
RUN chown -R node:node /app/scripts

# Vuelve a usuario de n8n
USER node

# n8n ya define el CMD/Entrypoint original, no lo toques
