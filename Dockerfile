FROM node:18-slim

# Install only what's needed
RUN apt-get update && \
    apt-get install -y ffmpeg wget unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no native build needed)
RUN npm ci --only=production

# Copy source code
COPY . .

# Download small English model (~40MB)
RUN wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    mv vosk-model-small-en-us-0.15 model && \
    rm vosk-model-small-en-us-0.15.zip

# Create uploads folder
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]