import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ScanLine } from 'lucide-react';
import Modal from './ui/Modal';

// Camera-based QR scanner: grabs frames from getUserMedia onto an offscreen
// canvas and decodes them with jsQR. Calls onDecode(rawPayloadString) once
// and stops the camera — the caller decides what a valid/invalid payload is.
const QrScannerModal = ({ open, onClose, onDecode, title = 'Scan check-in QR' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setError('');

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setError('Could not access the camera. Check browser permissions and try again.');
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          onDecodeRef.current(code.data);
          return;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    start();

    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-xl border-2 border-teal-400/80" />
            </div>
            <p className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 text-xs font-medium text-white/90">
              <ScanLine className="h-3.5 w-3.5" /> Point the camera at the member's check-in QR
            </p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </Modal>
  );
};

export default QrScannerModal;
