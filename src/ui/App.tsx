import { useRef, useEffect, useState, useCallback } from "react";
import Sidebar from "../components/sidebar";
import "./App.css";

const API_URL = "http://localhost:4000/api/ai/perspective";
const FPS_TARGET = 15;
const FRAME_INTERVAL = 1000 / FPS_TARGET;
const AI_PROCESS_INTERVAL = 200;
const MAX_IMAGE_WIDTH = 640;
const MAX_IMAGE_HEIGHT = 480;

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAIProcessTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const [fps, setFps] = useState(0);
  const [isStreamActive, setIsStreamActive] = useState(false);

  const captureAndProcessFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !aiCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      return;
    }

    const now = Date.now();
    
    if (now - lastFrameTimeRef.current >= FRAME_INTERVAL) {
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (ctx) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0);
      }
      lastFrameTimeRef.current = now;
    }

    if (!isProcessingRef.current && (now - lastAIProcessTimeRef.current >= AI_PROCESS_INTERVAL)) {
      isProcessingRef.current = true;
      lastAIProcessTimeRef.current = now;
      
      try {
        const processCanvas = document.createElement("canvas");
        const scale = Math.min(MAX_IMAGE_WIDTH / video.videoWidth, MAX_IMAGE_HEIGHT / video.videoHeight, 1);
        processCanvas.width = Math.floor(video.videoWidth * scale);
        processCanvas.height = Math.floor(video.videoHeight * scale);
        const processCtx = processCanvas.getContext("2d");
        
        if (processCtx) {
          processCtx.drawImage(video, 0, 0, processCanvas.width, processCanvas.height);
          
          processCanvas.toBlob(async (blob) => {
            if (!blob) {
              isProcessingRef.current = false;
              return;
            }

            const formData = new FormData();
            formData.append("image", blob, "frame.jpg");

            try {
              const response = await fetch(API_URL, {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const data = await response.json();

              if (data.image) {
                const aiCtx = aiCanvasRef.current?.getContext("2d");
                if (aiCtx && aiCanvasRef.current) {
                  const img = new Image();
                  img.onload = () => {
                    if (aiCanvasRef.current) {
                      aiCanvasRef.current.width = img.width;
                      aiCanvasRef.current.height = img.height;
                      aiCtx.drawImage(img, 0, 0);
                    }
                  };
                  img.src = `data:image/png;base64,${data.image}`;
                  
                  if (data.fps) {
                    setFps(data.fps);
                  }
                }
              }
            } catch (error) {
              console.error("Error processing frame:", error);
            } finally {
              isProcessingRef.current = false;
            }
          }, "image/jpeg", 0.85);
        } else {
          isProcessingRef.current = false;
        }
      } catch (error) {
        console.error("Error capturing frame:", error);
        isProcessingRef.current = false;
      }
    }
  }, []);

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Screen sharing is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } as MediaTrackConstraints,
        audio: false,
      });

      streamRef.current = stream;
      setIsStreamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("Stream assigned to video element");
        
        
        const handleLoadedMetadata = () => {
          console.log("Video metadata loaded, dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log("Video playback started");
            }).catch((err) => {
              console.error("Error playing video:", err);
            });
          }
        };

        videoRef.current.onloadedmetadata = handleLoadedMetadata;

        videoRef.current.play().catch((err) => {
          console.log("Initial play attempt failed (expected), will retry after metadata loads:", err);
        });

        let retryCount = 0;
        const maxRetries = 50;
        
        const startCapture = () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
            console.log("Starting frame capture loop");
            const captureLoop = () => {
              const track = streamRef.current?.getVideoTracks()[0];
              if (streamRef.current && track && track.readyState === 'live') {
                captureAndProcessFrame();
                animationFrameRef.current = requestAnimationFrame(captureLoop);
              } else {
                console.log("Stream ended, stopping capture");
                stopScreenShare();
              }
            };
            captureLoop();
          } else {
            retryCount++;
            if (retryCount < maxRetries) {
              setTimeout(startCapture, 100);
            } else {
              console.error("Failed to start capture: video not ready after max retries");
            }
          }
        };
        setTimeout(startCapture, 300);
      }

      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopScreenShare();
      });
    } catch (err) {
      console.error("Screen share error:", err);
      if (err instanceof Error) {
        alert(`Failed to start screen share: ${err.message}`);
      }
    }
  };

  const stopScreenShare = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const ctx = canvasRef.current?.getContext("2d");
    const aiCtx = aiCanvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (aiCtx && aiCanvasRef.current) {
      aiCtx.clearRect(0, 0, aiCanvasRef.current.width, aiCanvasRef.current.height);
    }

    setFps(0);
    setIsStreamActive(false);
  };

  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, []);

  return (
    <div className="app">
      <Sidebar />

      <div className="content">
        <div className="page">
          <div className="page-header">
            <h1>Hello USER!</h1>
          </div>

          <div className="panels-container">
            <div className="panel">
              <div className="panel-header">
                <h2>User Screenshare</h2>
              </div>
              <div className="panel-content">
                {!isStreamActive ? (
                  <div className="panel-placeholder">
                    <p>No screen share active</p>
                    <p className="placeholder-hint">Click "Start Screen Share" to begin</p>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="panel-canvas"
                    style={{ display: "block", maxWidth: "100%", height: "auto" }}
                  />
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>AI Model Perspective</h2>
                {fps > 0 && <span className="fps-indicator">FPS: {fps.toFixed(1)}</span>}
              </div>
              <div className="panel-content">
                {!isStreamActive ? (
                  <div className="panel-placeholder">
                    <p>AI processing will appear here</p>
                    <p className="placeholder-hint">Start screen share to see AI detection</p>
                  </div>
                ) : (
                  <canvas
                    ref={aiCanvasRef}
                    className="panel-canvas"
                    style={{ display: "block", maxWidth: "100%", height: "auto" }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="controls">
            <button onClick={startScreenShare} disabled={isStreamActive}>
              Start Screen Share
            </button>
            <button onClick={stopScreenShare} disabled={!isStreamActive}>
              Stop Screen Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
