# Service catalogue — à construire depuis la racine du dépôt (monorepo) :
#   docker build -f services/catalogue/Dockerfile -t maison-epouvante-catalogue .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copie du monorepo (filtré par .dockerignore), puis installation des seules dépendances de production du service
COPY . .
RUN npm ci --omit=dev --workspace services/catalogue --include-workspace-root=false \
  && npm cache clean --force

# Jamais root dans le conteneur
USER node

ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/catalogue/src/server.js"]
