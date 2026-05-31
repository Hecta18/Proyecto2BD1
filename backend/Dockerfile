FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY backend/src ./src
COPY frontend /app/frontend

FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./
COPY --from=build /app/backend/src ./src
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend /app/frontend
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
