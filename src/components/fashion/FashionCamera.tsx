import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { mediaDeadline } from '../../lib/fashionCaptureMedia';
import { FASHION_PHOTO_SLOTS, type FashionPhotoRole } from '../../lib/fashionPhotoSlots';

type Props = {
  initialRole: FashionPhotoRole;
  counts: Record<FashionPhotoRole, number>;
  onCapture: (role: FashionPhotoRole, file: File) => boolean;
  onClose: () => void;
  onNativeCapture: (role: FashionPhotoRole) => void;
};
const stopStream = (stream: MediaStream) => stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
function cameraError(error: unknown) {
  const name = (error as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser settings, then retry or upload a photo.';
  if (name === 'NotFoundError') return 'No camera was found. Connect a camera or upload a photo.';
  if (name === 'NotReadableError') return 'The camera is busy. Close other apps using it, then retry.';
  return error instanceof Error ? error.message : 'The camera could not start. Retry or use your device camera.';
}

/** A user-opened stream only; closing, hiding or leaving always releases the camera. */
export default function FashionCamera({ initialRole, counts, onCapture, onClose, onNativeCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [role, setRole] = useState(initialRole);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<{ file: File; url: string }>();
  const shotRef = useRef(shot); shotRef.current = shot;
  const latest = useRef({ onClose, onCapture }); latest.current = { onClose, onCapture };
  const cameraSlots = FASHION_PHOTO_SLOTS.filter((slot) => slot.camera);
  const selected = cameraSlots.find((slot) => slot.role === role)!;
  const full = counts[role] >= selected.max || Object.values(counts).reduce((a, b) => a + b, 0) >= 24;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') latest.current.onClose();
      if (event.key !== 'Tab') return;
      const targets = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)') ?? [])];
      const first = targets[0]; const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
      if (shotRef.current) URL.revokeObjectURL(shotRef.current.url);
    };
  }, []);

  useEffect(() => {
    const id = ++generation.current;
    setStatus('starting'); setError('');
    function stop() {
      ++generation.current;
      if (streamRef.current) stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    function hidden() {
      if (document.hidden) { stop(); setStatus('error'); setError('Camera paused while you were away. Resume when you are ready.'); }
    }
    document.addEventListener('visibilitychange', hidden);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera needs a secure browser connection. Open this app over HTTPS, or use your device camera below.');
        const stream = await mediaDeadline(navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } }), 15_000, 'Camera access is taking too long. Allow access in your browser, then retry.', stopStream);
        if (generation.current !== id) { stopStream(stream); return; }
        streamRef.current = stream;
        stream.getVideoTracks().forEach((track) => { track.onended = () => {
          if (generation.current !== id) return;
          stop(); setStatus('error'); setError('The camera disconnected. Reconnect it and retry, or upload a photo.');
        }; });
        const video = videoRef.current;
        if (!video) { stopStream(stream); return; }
        video.srcObject = stream;
        await mediaDeadline(video.play(), 8_000, 'Camera preview could not start. Please retry.');
        if (generation.current === id) setStatus('ready');
      } catch (reason) {
        if (generation.current !== id) return;
        stop(); setStatus('error'); setError(cameraError(reason));
      }
    }
    void start();
    return () => { stop(); document.removeEventListener('visibilitychange', hidden); };
  }, [facing, attempt]);

  async function capture() {
    const video = videoRef.current;
    if (!video || capturing || full) return;
    if (!video.videoWidth || !video.videoHeight) { setError('The preview is still starting. Try again in a moment.'); return; }
    setCapturing(true); setError('');
    const id = generation.current;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not capture this frame. Use the device camera below.');
      context.drawImage(video, 0, 0);
      const blob = await mediaDeadline(new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92)), 8_000, 'Photo capture took too long. Please retry.');
      if (generation.current !== id) return;
      if (!blob) throw new Error('The photo could not be captured. Please retry.');
      const file = new File([blob], `${role}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setShot({ file, url: URL.createObjectURL(file) });
    } catch (reason) { if (generation.current === id) setError(cameraError(reason)); }
    finally { setCapturing(false); }
  }
  function clearShot() { if (shot) URL.revokeObjectURL(shot.url); setShot(undefined); }
  function keepShot() {
    if (!shot || !latest.current.onCapture(role, shot.file)) return;
    clearShot();
    const next = cameraSlots.find((slot) => slot.min > counts[slot.role] + (slot.role === role ? 1 : 0))
      ?? cameraSlots.find((slot) => slot.role === 'additional' && counts.additional + (role === 'additional' ? 1 : 0) < slot.max);
    if (next) setRole(next.role);
  }

  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-2 sm:p-6">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fashion-camera-title" className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-slate-950 p-3 text-white sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 id="fashion-camera-title" className="text-lg font-semibold">Photograph garment</h2><p className="text-sm text-slate-300">{selected.label} · {selected.hint}</p></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close camera" className="rounded-full p-3 hover:bg-slate-800"><X size={22} /></button>
      </div>
      <div className="relative min-h-40 overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" className={`max-h-[48dvh] w-full object-contain ${shot ? 'invisible' : ''}`} />
        {shot && <img src={shot.url} alt={`Review ${selected.label.toLowerCase()} photo`} className="absolute inset-0 h-full w-full object-contain" />}
        {status === 'starting' && <p role="status" className="absolute inset-0 flex items-center justify-center bg-black/70 p-5 text-center">Starting camera… Allow camera access when prompted.</p>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-amber-950 p-3 text-sm text-amber-100">{error}</p>}
      <div className="my-3 flex flex-wrap gap-2" aria-label="Photo slot">
        {cameraSlots.map((slot) => <button key={slot.role} type="button" disabled={!!shot || counts[slot.role] >= slot.max} aria-pressed={role === slot.role} onClick={() => setRole(slot.role)} className={`min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40 ${role === slot.role ? 'border-pink-400 bg-pink-600' : 'border-slate-600'}`}>{slot.label} {counts[slot.role]}/{slot.max}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {shot ? <><button type="button" className="min-h-12 rounded-xl border border-slate-500 px-6" onClick={clearShot}>Retake</button><button type="button" disabled={full} className="min-h-12 rounded-xl bg-pink-600 px-6 font-semibold disabled:opacity-40" onClick={keepShot}>Use photo & continue</button></>
          : <><button type="button" aria-label="Switch camera" disabled={status === 'starting' || capturing} onClick={() => setFacing((value) => value === 'environment' ? 'user' : 'environment')} className="min-h-12 rounded-xl border border-slate-500 px-4 disabled:opacity-40"><SwitchCamera size={22} /></button>
            {status === 'error' ? <button type="button" onClick={() => setAttempt((value) => value + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-pink-600 px-6 font-semibold"><RefreshCw size={18} /> Retry camera</button>
              : <button type="button" disabled={status !== 'ready' || capturing || full} onClick={() => void capture()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-pink-600 px-6 font-semibold disabled:opacity-40"><Camera size={20} /> {capturing ? 'Capturing…' : `Capture ${selected.label.toLowerCase()}`}</button>}</>}
      </div>
      <p role="status" className="mt-3 text-center text-xs text-slate-300">{full ? 'This slot is full. Choose another slot or close the camera.' : 'Photos upload in the background. You can keep taking photos.'}</p>
      <button type="button" onClick={() => { onNativeCapture(role); onClose(); }} className="mt-3 min-h-11 text-sm underline">Use device camera instead</button>
    </div>
  </div>, document.body);
}
