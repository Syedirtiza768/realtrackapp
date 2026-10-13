import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react';
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
      // Match the visible object-cover frame instead of saving unseen side areas.
      const preview = video.getBoundingClientRect();
      const aspect = preview.width / preview.height;
      const sourceAspect = video.videoWidth / video.videoHeight;
      const sourceWidth = sourceAspect > aspect ? video.videoHeight * aspect : video.videoWidth;
      const sourceHeight = sourceAspect > aspect ? video.videoHeight : video.videoWidth / aspect;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth));
      canvas.height = Math.max(1, Math.round(sourceHeight));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not capture this frame. Use the device camera below.');
      context.drawImage(video, (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
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

  const totalPhotos = Object.values(counts).reduce((total, count) => total + count, 0);
  const safeSides = { paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' };
  return createPortal(<div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fashion-camera-title" className="fixed inset-0 z-[100] isolate h-[100dvh] w-full overflow-hidden bg-black text-white">
    <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" className={`absolute inset-0 h-full w-full touch-none object-cover ${shot ? 'invisible' : ''}`} />
    {shot && <img src={shot.url} alt={`Review ${selected.label.toLowerCase()} photo`} className="absolute inset-0 h-full w-full bg-black object-contain" />}
    {status === 'starting' && <p role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-sm">Starting camera… Allow camera access when prompted.</p>}

    <header className="absolute inset-x-0 top-0 z-10 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-3 bg-gradient-to-b from-black/85 to-transparent pb-8" style={{ ...safeSides, paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Close camera" className="flex min-h-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/70"><X size={24} /></button>
      <div className="min-w-0 pt-0.5 text-center"><h2 id="fashion-camera-title" className="text-base font-semibold">Photograph garment</h2><p className="mt-1 truncate text-xs text-white/85" title={selected.hint}>{selected.label} · {selected.hint}</p></div>
      <button type="button" aria-label="Switch camera" disabled={!!shot || status === 'starting' || capturing} onClick={() => setFacing((value) => value === 'environment' ? 'user' : 'environment')} className="flex min-h-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 disabled:opacity-40"><SwitchCamera size={24} /></button>
    </header>

    <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 bg-gradient-to-t from-black/95 via-black/65 to-transparent pt-8 [@media(max-height:500px)]:space-y-2 [@media(max-height:500px)]:pt-3" style={{ ...safeSides, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {error && <p role="alert" className="mx-auto max-h-[25dvh] max-w-xl overflow-y-auto rounded-lg bg-amber-950/95 p-3 text-sm text-amber-100">{error}</p>}
      <div className="mx-auto flex max-w-md gap-1.5" aria-label="Photo slot">
        {cameraSlots.map((slot) => <button key={slot.role} type="button" aria-label={`${slot.label} photo slot, ${counts[slot.role]} of ${slot.max}`} disabled={!!shot || counts[slot.role] >= slot.max} aria-pressed={role === slot.role} onClick={() => setRole(slot.role)} className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1 py-1 text-xs disabled:opacity-50 ${role === slot.role ? 'border-pink-400 bg-pink-600' : 'border-white/30 bg-black/30'}`}>
          <span className="flex items-center gap-1 font-semibold">{slot.role === 'tag' ? 'Label' : slot.role === 'additional' ? 'Details' : slot.label}{slot.min > 0 && counts[slot.role] >= slot.min && <Check size={12} aria-hidden="true" />}</span>
          <span className="text-[10px] text-white/75">{counts[slot.role]}/{slot.max}</span>
        </button>)}
      </div>
      {shot ? <div className="mx-auto flex max-w-md items-center justify-center gap-3 py-2"><button type="button" className="min-h-12 flex-1 rounded-xl border border-white/50 bg-black/30 px-4 font-semibold" onClick={clearShot}>Retake</button><button type="button" disabled={full} className="min-h-12 flex-[2] rounded-xl bg-pink-600 px-4 font-semibold disabled:opacity-40" onClick={keepShot}>Use photo & continue</button></div>
        : <div className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button type="button" aria-label="Use device camera instead" onClick={() => { onNativeCapture(role); onClose(); }} className="min-h-11 justify-self-start rounded-lg px-2 text-left text-xs text-white/85 underline">Device camera</button>
          {status === 'error' ? <button type="button" onClick={() => setAttempt((value) => value + 1)} className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-pink-600 px-4 font-semibold"><RefreshCw size={18} /> Retry camera</button>
            : <button type="button" aria-label={capturing ? 'Capturing photo' : `Capture ${selected.label.toLowerCase()}`} disabled={status !== 'ready' || capturing || full} onClick={() => void capture()} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 p-1 disabled:opacity-40 [@media(max-height:500px)]:h-14 [@media(max-height:500px)]:w-14"><span className="flex h-full w-full items-center justify-center rounded-full bg-white text-slate-950">{capturing ? <Loader2 className="animate-spin" size={26} /> : <Camera size={26} />}</span></button>}
          <span className="justify-self-end text-right text-xs text-white/85">{totalPhotos} photo{totalPhotos === 1 ? '' : 's'}</span>
        </div>}
      <p role="status" className="text-center text-xs text-white/75">{full ? 'Slot full. Choose another slot or close the camera.' : shot ? 'Check the whole photo, then continue.' : 'Uploads continue while you photograph.'}</p>
    </div>
  </div>, document.body);
}
