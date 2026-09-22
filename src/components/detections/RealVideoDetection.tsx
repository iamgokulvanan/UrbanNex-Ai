import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileVideo, Loader2, ScanSearch, UploadCloud } from 'lucide-react';

type VideoDetection = {
  class: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  frame: number;
  timestamp: number;
  frame_image?: string;
};

type VideoResponse = {
  success: boolean;
  video_name: string;
  detections: VideoDetection[];
  total_detections: number;
};

interface RealVideoDetectionProps {
  onVideoAnalyzed?: (detections: VideoDetection[], videoName?: string) => void;
}

const supportedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const maxVideoBytes = 200 * 1024 * 1024;

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${String(minutes).padStart(2, '0')}:${remainder}`;
}

export const RealVideoDetection: React.FC<RealVideoDetectionProps> = ({ onVideoAnalyzed }) => {
  const [video, setVideo] = useState<File | null>(null);
  const [result, setResult] = useState<VideoResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [error, setError] = useState('');

  const previewFrames = useMemo(() => {
    if (!result) return [];
    return result.detections.filter((detection, index, all) => (
      detection.frame_image && all.findIndex(item => item.frame === detection.frame) === index
    ));
  }, [result]);

  const selectVideo = (file?: File) => {
    setError('');
    setResult(null);
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!supportedExtensions.includes(extension)) {
      setVideo(null);
      setStatus('error');
      setError('Invalid file type. Please choose an MP4, MOV, AVI, or MKV video.');
      return;
    }
    if (file.size > maxVideoBytes) {
      setVideo(null);
      setStatus('error');
      setError('Video file is too large. Please choose a file smaller than 200 MB.');
      return;
    }
    setVideo(file);
    setStatus('idle');
  };

  const analyzeVideo = async () => {
    if (!video) {
      setStatus('error');
      setError('Select a video before starting analysis.');
      return;
    }
    setStatus('processing');
    setError('');
    const formData = new FormData();
    formData.append('video', video);
    try {
      const response = await fetch(`${backendUrl}/api/detections/video`, { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `Video processing failed (${response.status}).`);
      const videoResult = data as VideoResponse;
      setResult(videoResult);
      onVideoAnalyzed?.(videoResult.detections, videoResult.video_name);
      setStatus('complete');
    } catch (requestError) {
      setStatus('error');
      setError(requestError instanceof Error ? requestError.message : 'Backend unavailable. Start FastAPI and try again.');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Real computer vision</p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Real AI Video Detection</h1>
        <p className="text-sm text-slate-500 mt-1">Upload a road video and inspect detections from the trained YOLO pothole model.</p>
      </div>
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <label className="flex-1 cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl px-4 py-5 transition-colors">
            <input type="file" accept=".mp4,.mov,.avi,.mkv,video/*" className="sr-only" onChange={event => selectVideo(event.target.files?.[0])} />
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FileVideo className="w-5 h-5" /></div><div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{video?.name || 'Select a road video'}</p><p className="text-xs text-slate-500">MP4, MOV, AVI, or MKV</p></div><UploadCloud className="ml-auto w-5 h-5 text-slate-400 shrink-0" /></div>
          </label>
          <button onClick={analyzeVideo} disabled={status === 'processing'} className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-colors">{status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}{status === 'processing' ? 'Analyzing video...' : 'Analyze Video'}</button>
        </div>
        {status === 'processing' && <div className="mt-4 h-1.5 rounded-full bg-blue-100 overflow-hidden"><div className="h-full w-1/3 bg-blue-600 rounded-full animate-pulse" /></div>}
        {error && <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
      </section>
      {result && <section className="space-y-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="text-xs text-slate-500">Analyzed video</p><h2 className="text-lg font-bold text-slate-900 truncate max-w-xl">{result.video_name}</h2></div><div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2"><CheckCircle2 className="w-4 h-4" /> {result.total_detections} pothole{result.total_detections === 1 ? '' : 's'} detected</div></div>{result.detections.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">No potholes detected in the analyzed video.</div> : <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{previewFrames.map(detection => <div key={detection.frame} className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-200"><img src={detection.frame_image} alt={`Pothole detected at frame ${detection.frame}`} className="w-full aspect-video object-contain" /><div className="absolute left-3 top-3 bg-red-600 text-white text-xs font-bold rounded-lg px-2 py-1">Pothole · {(detection.confidence * 100).toFixed(1)}%</div></div>)}</div><div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800">Detection Results</div><div className="divide-y divide-slate-100">{result.detections.map((detection, index) => <div key={`${detection.frame}-${detection.bbox.x1}-${index}`} className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm"><div><p className="text-[11px] text-slate-400 uppercase">Class</p><p className="font-bold text-slate-800 capitalize">{detection.class}</p></div><div><p className="text-[11px] text-slate-400 uppercase">Confidence</p><p className="font-bold text-blue-700">{(detection.confidence * 100).toFixed(1)}%</p></div><div><p className="text-[11px] text-slate-400 uppercase">Frame</p><p className="font-bold text-slate-800">{detection.frame}</p></div><div><p className="text-[11px] text-slate-400 uppercase">Timestamp</p><p className="font-bold text-slate-800">{formatTimestamp(detection.timestamp)}</p></div></div>)}</div></div></>}</section>}
    </div>
  );
};