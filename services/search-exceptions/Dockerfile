FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY services/search-exceptions/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY services/search-exceptions/app.js ./

EXPOSE 3004

CMD ["node", "app.js"]