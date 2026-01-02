import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 4000;

let inferenceService = null;
let serviceReady = false;
const serviceQueue = [];

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: join(__dirname, 'temp'),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const tempDir = join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const unlinkAsync = promisify(fs.unlink);

async function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
}

function startInferenceService() {
  const pythonScriptPath = join(__dirname, '..', 'LicenseAI', 'inference_service.py');
  const modelPath = join(__dirname, '..', 'LicenseAI', 'License.engine');
  const modelPathPt = join(__dirname, '..', 'LicenseAI', 'License.pt');
  let finalModelPath = modelPath;
  if (fs.existsSync(modelPath)) {
    finalModelPath = modelPath;
  } else if (fs.existsSync(modelPathPt)) {
    finalModelPath = modelPathPt;
  }

  console.log('Starting inference service with model:', finalModelPath);

  const env = Object.assign({}, process.env);
  env.TRT_LOGGER_VERBOSITY = 'ERROR';

  inferenceService = spawn('python', [pythonScriptPath, '--model', finalModelPath], {
    cwd: join(__dirname, '..'),
    env: env,
  });

  let buffer = '';

  inferenceService.stdout.on('data', function (data) {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const response = JSON.parse(line);
        const item = serviceQueue.shift();
        if (item && item.resolve) item.resolve(response);
      } catch (err) {
        console.error('Failed to parse response from inference service:', line);
      }
    }
  });

  inferenceService.stderr.on('data', function (data) {
    const message = data.toString().trim();
    if (message && !message.includes('TRT')) {
      console.log('[Inference Service]:', message);
    }
  });

  inferenceService.on('close', function (code) {
    console.error('Inference service exited with code', code);
    serviceReady = false;
    inferenceService = null;
    while (serviceQueue.length > 0) {
      const item = serviceQueue.shift();
      if (item && item.reject) item.reject(new Error('Service disconnected'));
    }
    setTimeout(function () {
      console.log('Restarting inference service...');
      startInferenceService();
    }, 2000);
  });

  inferenceService.on('error', function (error) {
    console.error('Failed to start inference service:', error);
    serviceReady = false;
  });

  setTimeout(function () {
    sendServiceRequest({ action: 'ping' }).then(function () {
      serviceReady = true;
      console.log('Inference service ready');
    }).catch(function (err) {
      console.error('Service ping failed:', err);
    });
  }, 3000);
}

function sendServiceRequest(request, timeout = 30000) {
  return new Promise(function (resolve, reject) {
    if (!inferenceService || inferenceService.killed) {
      reject(new Error('Service not available'));
      return;
    }

    const timer = setTimeout(function () {
      
      for (let i = 0; i < serviceQueue.length; i++) {
        if (serviceQueue[i].resolve === resolve) {
          serviceQueue.splice(i, 1);
          break;
        }
      }
      reject(new Error('Request timeout'));
    }, timeout);

    const item = {
      resolve: function (data) { clearTimeout(timer); resolve(data); },
      reject: function (err) { clearTimeout(timer); reject(err); }
    };

    serviceQueue.push(item);

    try {
      inferenceService.stdin.write(JSON.stringify(request) + '\n');
    } catch (err) {
      // remove item on error
      const idx = serviceQueue.indexOf(item);
      if (idx !== -1) serviceQueue.splice(idx, 1);
      clearTimeout(timer);
      reject(err);
    }
  });
}

app.post('/api/ai/perspective', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const imagePath = req.file.path;

  if (!serviceReady) {
    await cleanupFile(imagePath);
    return res.status(503).json({
      error: 'Inference service not ready',
      message: 'Service is still initializing. Please try again in a moment.',
    });
  }

  try {
    const result = await sendServiceRequest({
      action: 'process',
      image_path: imagePath,
    });

    await cleanupFile(imagePath);

    if (result.error) {
      return res.status(500).json({
        error: 'Inference failed',
        details: result.error,
      });
    }

    res.json({
      image: result.image,
      boxes: result.boxes || [],
      fps: result.fps || 0,
    });
  } catch (error) {
    await cleanupFile(imagePath);
    console.error('Inference request failed:', error);
    res.status(500).json({
      error: 'Inference request failed',
      details: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

startInferenceService();

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (inferenceService) {
    sendServiceRequest({ action: 'exit' }).catch(() => {});
    setTimeout(() => {
      if (inferenceService) {
        inferenceService.kill();
      }
      process.exit(0);
    }, 1000);
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (inferenceService) {
    sendServiceRequest({ action: 'exit' }).catch(() => {});
    setTimeout(() => {
      if (inferenceService) {
        inferenceService.kill();
      }
      process.exit(0);
    }, 1000);
  } else {
    process.exit(0);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Waiting for inference service to initialize...');
});

