# ===== Stage 1: Build Frontend =====
FROM node:22-alpine AS frontend-build

WORKDIR /build
COPY ai-stylist-frontend/package*.json ./
RUN npm install
COPY ai-stylist-frontend/ ./
RUN npm run build

# ===== Stage 2: Production Container =====
FROM python:3.10-slim

# Install nginx and system deps
RUN apt-get update && \
    apt-get install -y gcc sqlite3 nginx && \
    rm -rf /var/lib/apt/lists/*

# Copy backend
WORKDIR /app/backend
COPY ai-stylist-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-stylist-backend/ .
RUN mkdir -p uploads

# Copy built frontend to nginx html
COPY --from=frontend-build /build/dist /usr/share/nginx/html

# Copy nginx config and startup script
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]
