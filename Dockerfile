FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=4173
EXPOSE 4173

CMD ["node", "scripts/dev.mjs"]
