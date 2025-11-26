FROM node:18

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg wget unzip python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production || npm install --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads models

# Download and extract Vosk model
RUN cd models && \
    wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    rm vosk-model-small-en-us-0.15.zip

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]