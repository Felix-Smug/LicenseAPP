import cv2
import numpy as np
import time
import sys
import json
import base64
import argparse
import warnings
import os
from ultralytics import YOLO

warnings.filterwarnings('ignore')
os.environ['TRT_LOGGER_VERBOSITY'] = 'ERROR'

def encode_image_to_base64(image):
    _, buffer = cv2.imencode('.png', image)
    image_base64 = base64.b64encode(buffer).decode('utf-8')
    return image_base64

def process_frame(frame, model):
    results = model.predict(
        source=frame,
        conf=0.4,
        device=0,
        verbose=False
    )

    boxes_data = []
    for r in results:
        if r.boxes is None:
            continue

        for box in r.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            if label != "License_Plate":
                continue
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                frame,
                f"{label} {conf:.2f}",
                (x1, y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )
            boxes_data.append({
                "label": label,
                "confidence": conf,
                "bbox": [x1, y1, x2, y2]
            })

    return frame, boxes_data

def main():
    parser = argparse.ArgumentParser(description='YOLO License Plate Inference')
    parser.add_argument('--image', type=str, required=True, help='Path to input image')
    parser.add_argument('--model', type=str, required=True, help='Path to YOLO model file')
    args = parser.parse_args()

    try:
        model = YOLO(args.model, task='detect')

        frame = cv2.imread(args.image)
        if frame is None:
            print(json.dumps({'error': 'Failed to read image file'}), file=sys.stderr)
            sys.exit(1)

        start_time = time.time()
        annotated_frame, boxes = process_frame(frame, model)
        inference_time = time.time() - start_time
        fps = 1.0 / inference_time if inference_time > 0 else 0

        cv2.putText(annotated_frame, f'FPS: {fps:.1f}', (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        image_base64 = encode_image_to_base64(annotated_frame)
        result = {'image': image_base64, 'boxes': boxes, 'fps': round(fps, 2)}
        print(json.dumps(result))
        sys.stdout.flush()

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

