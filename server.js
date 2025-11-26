const express = require('express');
const multer = require('multer');
const vosk = require('vosk');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;
const MODEL_PATH = path.join(__dirname, 'model');

// Set log level (0 = no logs, -1 = verbose)
vosk.setLogLevel(0);

console.log("Loading Vosk model...");
const model = new vosk.Model(MODEL_PATH);
console.log("Model loaded successfully!");

// Multer config
const upload = multer({ dest: 'uploads/' });

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());

// Convert any audio to 16kHz mono WAV
const convertToWav = (input, output) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', input,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y', // overwrite
      output
    ]);

    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg error: ${code}`)));
    ffmpeg.stderr.on('data', data => console.log('FFmpeg:', data.toString()));
  });
};

// Main STT endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file' });

  const inputPath = req.file.path;
  const wavPath = inputPath + '.wav';

  try {
    await convertToWav(inputPath, wavPath);

    const wf = fs.readFileSync(wavPath);
    const recognizer = new vosk.Recognizer({ model, sampleRate: 16000 });

    recognizer.acceptWaveform(wf);
    const result = recognizer.finalResult();

    recognizer.free();

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(wavPath);

    res.json({
      success: true,
      transcript: result.text.trim() || "(no speech detected)",
      confidence: result.conf || null
    });

  } catch (err) {
    console.error("STT Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: "ok", model: "loaded" });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Speech-to-Text server running on http://localhost:${PORT}`);
});