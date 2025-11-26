FROM node:18

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg wget unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Download and extract Vosk model
RUN mkdir -p models && \
    cd models && \
    wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip && \
    unzip vosk-model-small-en-us-0.15.zip && \
    rm vosk-model-small-en-us-0.15.zip

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]