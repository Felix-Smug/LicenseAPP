import { useRef } from "react";
import Sidebar from "../components/sidebar";
import logo from "../assets/logo.png";
import "./App.css";

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Screen sharing is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };


  

  return (
    <div className="app">
      <Sidebar />

      <div className="content">
        <div className="page">
          <div className="page-top">
            <div>
              <h1>Hello User! <img src={logo} alt="Logo" className="page-logo" width={75} height={75} /> </h1>
              <p>______________________________________________________________</p>

              <button onClick={startScreenShare}>
                Start Screen Share!
              </button>

              <button onClick={stopScreenShare}>
                Stop Screen Share!
              </button>

              <video
                ref={videoRef}
                autoPlay
                muted
                style={{ width: "100%", marginTop: "16px" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
