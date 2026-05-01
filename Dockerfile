FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build is skipped because the user prefers running in dev mode locally
EXPOSE 3069 5173

# Start the dev server for both FE and BE
CMD ["npm", "run", "dev:full"]
