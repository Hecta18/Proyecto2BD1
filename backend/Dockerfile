FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY frontend /app/frontend
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
