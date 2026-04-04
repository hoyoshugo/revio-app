FROM node:22-alpine

WORKDIR /app

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy all source files
COPY . .

# Build frontend with production API URL
ARG VITE_API_URL=https://revio-app-production.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}
RUN cd frontend && npm run build

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
