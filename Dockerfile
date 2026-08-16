FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["node", "server/index.js"]
