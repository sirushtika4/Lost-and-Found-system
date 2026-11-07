FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.js app.js ./
COPY --chown=node:node config ./config
COPY --chown=node:node auth ./auth
COPY --chown=node:node models ./models
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node routes ./routes

USER node

EXPOSE 5000

CMD ["node", "server.js"]
