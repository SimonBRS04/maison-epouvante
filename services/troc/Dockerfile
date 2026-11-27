# troc service — build from the repository root (monorepo):
#   docker build -f services/troc/Dockerfile -t maison-epouvante-troc .
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copy the monorepo (filtered by .dockerignore), then install only this service's production dependencies
COPY . .
RUN npm ci --omit=dev --workspace services/troc --include-workspace-root=false \
  && npm cache clean --force

# Never run as root inside the container
USER node

ENV PORT=3002
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "services/troc/src/server.js"]
