// server.js
const express = require('express');
const multer = require('multer');
const vosk = require('vosk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (for React frontend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Path to Vosk model (download from https://alphacephei.com/vosk/models)
const MODEL_PATH = process.env.MODEL_PATH || path.join(__dirname, 'models', 'vosk-model-small-en-us-0.15');

let model;

// Initialize Vosk model
const initializeModel = async () => {
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.error('Model not found. Please download a Vosk model from https://alphacephei.com/vosk/models');
      console.error(`Extract it to: ${MODEL_PATH}`);
      process.exit(1);
    }
    
    vosk.setLogLevel(0);
    model = new vosk.Model(MODEL_PATH);
    console.log('Vosk model loaded successfully');
  } catch (error) {
    console.error('Error loading Vosk model:', error);
    process.exit(1);
  }
};

// Convert audio to required format (16kHz, mono, WAV)
const convertAudio = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
};

// Speech-to-text endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const inputPath = req.file.path;
  const convertedPath = `${inputPath}_converted.wav`;

  try {
    // Convert audio to proper format
    await convertAudio(inputPath, convertedPath);

    // Create recognizer
    const rec = new vosk.Recognizer({ model, sampleRate: 16000 });

    // Read audio file
    const waveFile = fs.readFileSync(convertedPath);
    
    // Process audio in chunks
    const chunkSize = 4000;
    let transcript = '';
    
    for (let i = 0; i < waveFile.length; i += chunkSize) {
      const chunk = waveFile.slice(i, i + chunkSize);
      const endOfSpeech = rec.acceptWaveform(chunk);
      
      if (endOfSpeech) {
        const result = JSON.parse(rec.result());
        if (result.text) {
          transcript += result.text + ' ';
        }
      }
    }

    // Get final result
    const finalResult = JSON.parse(rec.finalResult());
    if (finalResult.text) {
      transcript += finalResult.text;
    }

    rec.free();

    // Clean up files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(convertedPath);

    res.json({
      success: true,
      transcript: transcript.trim(),
      confidence: finalResult.confidence || 'N/A'
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Clean up files
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);

    res.status(500).json({
      success: false,
      error: 'Error processing audio file',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    modelLoaded: !!model
  });
});

// Start server
const startServer = async () => {
  await initializeModel();
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();