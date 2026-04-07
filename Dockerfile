# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./
COPY --from=build /app/tsconfig.json ./

# Install su-exec and shadow (for usermod/groupmod)
RUN apk add --no-cache su-exec shadow
RUN npm install -g tsx

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Copy entrypoint script and make it executable
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Ensure data directory exists
RUN mkdir -p /app/data

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["tsx", "server.ts"]
