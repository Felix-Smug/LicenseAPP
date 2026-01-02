# License Plat

https://github.com/user-attachments/assets/e6606942-7f01-4d9c-b252-d40ad0b5f8cd

e AI

## Installation

### 1. Install Python Dependencies

```bash
pip install ultralytics opencv-python numpy
```

### 2. Install Node.js Dependencies

```bash
npm install
```

## Running the Application

### Step 1: Start the Backend Server

Open a terminal and run:

```bash
npm run dev:server
```

The server will start on `http://localhost:4000`

### Step 2: Start the Frontend

Open another terminal and run:

```bash
npm run dev:react
```

The frontend will be available at `http://localhost:5173` 

## API Endpoints

### POST `/api/ai/perspective`

Processes an image frame through the YOLO model.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `image` (file) - PNG or JPEG image

**Response:**
```json
{
  "image": "base64_encoded_png_string",
  "boxes": [
    {
      "label": "License_Plate",
      "confidence": 0.95,
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "fps": 15.2
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "port": 4000
}
```

## Configuration

### Frame Rate

Default target FPS is 15 frames per second. To adjust, edit `src/ui/App.tsx`:

```typescript
const FPS_TARGET = 15;
```

### Detection Confidence

Default confidence threshold is 0.4. To adjust, edit `LicenseAI/inference_service.py`:

```python
results = model.predict(
    source=frame,
    conf=0.4,  (change this value )
    device=0,
    verbose=False
)
```

## Troubleshooting

### CUDA/GPU Errors

1. Verify CUDA is installed: `nvidia-smi`
2. Check that PyTorch/Ultralytics can detect your GPU
3. If GPU is not available, the model will fall back to CPU (slower)

### Model File Not Found

Ensure either `LicenseAI/License.engine` or `LicenseAI/License.pt` exists. The server will automatically detect and use the available model file.

**Performance Note:**
- `.engine` files (TensorRT) provide faster inference but take longer to load
- `.pt` files (PyTorch) load faster but inference is slightly slower
