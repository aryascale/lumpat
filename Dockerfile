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

# Build the frontend for production
RUN npm run build

EXPOSE 3069

# Start the production backend server (which will also serve the static frontend)
CMD ["npm", "run", "server"]
