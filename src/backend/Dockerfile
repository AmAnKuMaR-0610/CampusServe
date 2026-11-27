# Production-ready Cloud Run container for CampusServe Backend
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source
COPY . .

# Cloud Run injects PORT (default 8080 in GCP Cloud Run, 4000 locally)
ENV NODE_ENV=production
ENV PORT=4000
ENV GOOGLE_CLOUD_PROJECT=floci-local

EXPOSE 4000

CMD ["node", "server.js"]
