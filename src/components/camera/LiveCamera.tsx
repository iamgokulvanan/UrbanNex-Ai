import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CircleAlert, MapPin, ShieldCheck, Upload } from 'lucide-react';
import { DetectionType } from '../../types';

type CameraStatus = 'idle' | 'starting' | 'active' | 'error';

const getCameraErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'The camera is unavailable or already being used by another application.';
    }
    if (error.name === 'OverconstrainedError') {
      return 'The rear camera is unavailable. Check your device camera settings and try again.';
    }
  }

  return 'Camera access is unavailable. Use a modern browser over HTTPS or localhost, then try again.';
};

interface LiveCameraProps {
  onSubmitDetection: (payload: {
    detectionType: DetectionType;
    latitude: number;
    longitude: number;
    gpsAccuracy?: number;
    timestamp: string;
    evidenceImage?: string;
  }) => void | Promise<void>;
  onOpenMap: () => void;
}

export const LiveCamera: React.FC<LiveCameraProps> = ({ onSubmitDetection, onOpenMap }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied' | 'unavailable'>('idle');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [issueType, setIssueType] = useState<DetectionType>('pothole');
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopLocation();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  };

  const stopLocation = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setGpsStatus('idle');
  };

  const startLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    setGpsStatus('searching');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGpsStatus('active');
      },
      (error) => setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const startCamera = async () => {
    setErrorMessage('');

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setStatus('error');
      setErrorMessage('Camera access requires HTTPS or localhost. Open the deployed app over HTTPS and try again.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMessage('This browser does not support camera access. Try the latest Chrome on Android or desktop.');
      return;
    }

    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startLocation();
      setStatus('active');
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus('error');
      setErrorMessage(getCameraErrorMessage(error));
    }
  };

  const captureEvidence = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !location || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCaptureMessage('Start the camera and wait for a GPS fix before capturing an issue.');
      return;
    }

    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.65);
    const timestamp = new Date().toISOString();
    setEvidenceImage(image);
    try {
      await onSubmitDetection({
        detectionType: issueType,
        latitude: location.latitude,
        longitude: location.longitude,
        gpsAccuracy: location.accuracy,
        timestamp,
        evidenceImage: image,
      });
      setCaptureMessage('Captured, analyzed, and sent to the UrbanNex detection stream.');
    } catch (error) {
      setCaptureMessage(error instanceof Error ? error.message : 'Unable to submit this camera capture.');
    }
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  const isActive = status === 'active';
  const isStarting = status === 'starting';

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 p-3 sm:p-4 md:space-y-6 md:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Prototype camera input</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Live Camera</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Use an Android phone as a temporary forward-facing camera for the UrbanNex command center.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
              <Camera className="h-4 w-4 text-blue-300" />
              <span className="truncate">Live camera preview</span>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${isActive ? 'text-emerald-300' : 'text-slate-400'}`}>
              <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {isActive ? 'Camera active' : isStarting ? 'Connecting...' : 'Camera stopped'}
            </span>
          </div>

          <div className="relative aspect-[4/3] w-full bg-slate-900 sm:aspect-video">
            <video
              ref={videoRef}
              className={`h-full w-full object-contain ${isActive ? 'block' : 'hidden'}`}
              autoPlay
              muted
              playsInline
              aria-label="Live rear camera preview"
            />
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-slate-400">
                <CameraOff className="mb-3 h-10 w-10 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">Camera preview is off</p>
                <p className="mt-1 max-w-sm text-xs">Start the camera to request permission and show the rear camera feed.</p>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Camera connection</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Permission is requested only after you press Start Camera. No video is recorded or uploaded.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><strong className={isActive ? 'text-emerald-600' : 'text-slate-700'}>{isActive ? 'Active' : isStarting ? 'Starting' : 'Inactive'}</strong></div>
            <div className="mt-2 flex items-start justify-between gap-3"><span className="text-slate-500">Camera preference</span><strong className="text-right text-slate-700">Rear / environment</strong></div>
            <div className="mt-2 flex items-start justify-between gap-3"><span className="text-slate-500">GPS</span><strong className={`text-right ${gpsStatus === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>{gpsStatus === 'active' ? 'Active' : gpsStatus === 'searching' ? 'Searching...' : gpsStatus === 'denied' ? 'Permission denied' : gpsStatus === 'unavailable' ? 'Unavailable' : 'Inactive'}</strong></div>
          </div>

          {location && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900"><div className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4" /> GPS Active</div><p className="mt-1 font-mono">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p><p className="mt-1 text-emerald-700">Accuracy: {Math.round(location.accuracy)} m</p></div>}

          {errorMessage && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {!isActive && (
              <button type="button" onClick={startCamera} disabled={isStarting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
                <Camera className="h-4 w-4" />
                {isStarting ? 'Starting camera...' : 'Start Camera'}
              </button>
            )}
            {isActive && (
              <button type="button" onClick={stopCamera} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </button>
            )}
          </div>

          {isActive && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual issue capture</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">This prototype captures evidence and location. It does not claim AI detection.</p>
              <label className="mt-3 block text-xs font-semibold text-slate-700">Issue type
                <select value={issueType} onChange={(event) => setIssueType(event.target.value as DetectionType)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                  <option value="pothole">Pothole</option><option value="road_damage">Damaged Road</option><option value="waterlogging">Waterlogging</option><option value="congestion">Traffic Congestion</option><option value="pedestrian_risk">Pedestrian Safety Issue</option>
                </select>
              </label>
              <button type="button" onClick={captureEvidence} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Upload className="h-4 w-4" /> Capture Issue & Show on GIS</button>
              {captureMessage && <p role="status" className="mt-2 text-xs text-slate-600">{captureMessage}</p>}
              {evidenceImage && <img src={evidenceImage} alt="Latest captured issue evidence" className="mt-3 aspect-video w-full rounded-lg object-cover" />}
              {captureMessage.startsWith('Captured') && <button type="button" onClick={onOpenMap} className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Open GIS Map</button>}
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </section>
  );
};
