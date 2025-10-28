# Stage 1: Build
FROM node:24-alpine3.21 AS builder
# Set working directory
WORKDIR /app
# Install dependencies
COPY package*.json ./
RUN npm ci
# Copy source files
COPY . .
# Build TypeScript
#RUN npm install @prisma/client
#RUN npm run prisma:generate

RUN chmod -R +x node_modules/.bin

RUN npx prisma generate
#RUN npx prisma db push --accept-data-loss

RUN npm run build
RUN ls -lrt /app/dist/

### Stage 2: Run
FROM node:24-alpine3.21
# Set working directory
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma  
COPY --from=builder /app/.env .env 



EXPOSE 9330
# Start the app
CMD ["node", "./dist/src/server/www.js"]
