import cv2
import numpy as np
import time
from ultralytics import YOLO
import bettercam

model = YOLO(r"C:\Users\Smugg\Documents\Github Repos\LicenseAPP\LicenseAI\License.engine")

WIDTH, HEIGHT = 1280, 720
SCREEN_W, SCREEN_H = 1920, 1080

left = SCREEN_W // 2 - WIDTH // 2
top = SCREEN_H // 2 - HEIGHT // 2

camera = bettercam.create(output_color="BGR")
prev_time = time.time()

while True:
    frame = camera.grab(region=(left, top, left + WIDTH, top + HEIGHT))
    if frame is None:
        continue

    frame = np.asarray(frame)

    results = model.predict(
        source=frame,
        conf=0.4,
        device=0,     
        verbose=False
    )

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

    now = time.time()
    fps = 1.0 / (now - prev_time)
    prev_time = now

    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    cv2.imshow("License Plate - Model View", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cv2.destroyAllWindows()
