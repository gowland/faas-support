FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY services/upload-service/package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY services/upload-service/src ./src

# Create uploads and notifications directories
RUN mkdir -p uploads notifications

EXPOSE 3001

CMD ["npm", "start"]
EXPOSE 3000

CMD ["node", "app.js"]