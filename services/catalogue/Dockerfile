# catalogue service — build from the repository root (monorepo):
#   docker build -f services/catalogue/Dockerfile -t maison-epouvante-catalogue .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copy the monorepo (filtered by .dockerignore), then install only this service's production dependencies
COPY . .
RUN npm ci --omit=dev --workspace services/catalogue --include-workspace-root=false \
  && npm cache clean --force

# Never run as root inside the container
USER node

ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/catalogue/src/server.js"]
