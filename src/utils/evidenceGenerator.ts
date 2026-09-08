import { DetectionType } from '../types';

/**
 * Generates an SVG data URI simulating an onboard bus camera evidence frame
 * with camera timestamp, GPS watermark, crosshairs, and road visual simulation.
 */
export function getSimulatedEvidenceImageUrl(
  type: DetectionType, 
  id: string, 
  busId: string, 
  timestamp: string, 
  confidence: number
): string {
  const dateStr = new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let hazardGraphic = '';
  let hazardLabel = '';
  let boxColor = '#ef4444'; // Red

  if (type === 'pothole') {
    hazardLabel = `POTHOLE (CONF: ${(confidence * 100).toFixed(1)}%)`;
    boxColor = '#dc2626';
    hazardGraphic = `
      <!-- Asphalt surface cavity -->
      <ellipse cx="320" cy="300" rx="90" ry="45" fill="#1e293b" stroke="#0f172a" stroke-width="4" />
      <ellipse cx="320" cy="300" rx="75" ry="35" fill="#0f172a" />
      <path d="M260,290 Q290,320 340,310 Q380,285 360,325 Q300,340 250,305 Z" fill="#020617" opacity="0.8" />
      <!-- Bounding Box -->
      <rect x="220" y="240" width="200" height="120" fill="none" stroke="${boxColor}" stroke-width="2.5" stroke-dasharray="8,4" />
      <rect x="220" y="215" width="190" height="25" fill="${boxColor}" />
      <text x="225" y="233" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${hazardLabel}</text>
    `;
  } else if (type === 'waterlogging') {
    hazardLabel = `WATERLOGGING (EST. 12cm)`;
    boxColor = '#2563eb';
    hazardGraphic = `
      <!-- Water pool reflection -->
      <ellipse cx="320" cy="320" rx="180" ry="60" fill="#1e3a8a" opacity="0.65" />
      <ellipse cx="320" cy="320" rx="150" ry="45" fill="#3b82f6" opacity="0.4" />
      <path d="M180,315 Q260,300 340,325 Q420,310 460,335" stroke="#93c5fd" stroke-width="2" fill="none" opacity="0.8" />
      <!-- Bounding Box -->
      <rect x="130" y="250" width="380" height="130" fill="none" stroke="${boxColor}" stroke-width="2.5" stroke-dasharray="8,4" />
      <rect x="130" y="225" width="210" height="25" fill="${boxColor}" />
      <text x="135" y="243" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${hazardLabel}</text>
    `;
  } else if (type === 'road_damage') {
    hazardLabel = `FATIGUE CRACKING (3.8m)`;
    boxColor = '#ea580c';
    hazardGraphic = `
      <!-- Asphalt cracks -->
      <path d="M240,260 L280,290 L270,330 L320,360 L360,380" stroke="#0f172a" stroke-width="5" fill="none" />
      <path d="M280,290 L330,300 L370,320 L350,350" stroke="#0f172a" stroke-width="4" fill="none" />
      <path d="M270,330 L240,350 L250,380" stroke="#0f172a" stroke-width="3" fill="none" />
      <!-- Bounding Box -->
      <rect x="210" y="240" width="200" height="150" fill="none" stroke="${boxColor}" stroke-width="2.5" stroke-dasharray="8,4" />
      <rect x="210" y="215" width="210" height="25" fill="${boxColor}" />
      <text x="215" y="233" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${hazardLabel}</text>
    `;
  } else if (type === 'congestion') {
    hazardLabel = `TRAFFIC BOTTLENECK (<5 km/h)`;
    boxColor = '#d97706';
    hazardGraphic = `
      <!-- Vehicles silhouettes -->
      <rect x="260" y="230" width="60" height="50" rx="6" fill="#334155" />
      <rect x="330" y="240" width="50" height="40" rx="5" fill="#475569" />
      <rect x="210" y="250" width="45" height="35" rx="5" fill="#1e293b" />
      <!-- Bounding Box -->
      <rect x="180" y="210" width="240" height="120" fill="none" stroke="${boxColor}" stroke-width="2.5" stroke-dasharray="8,4" />
      <rect x="180" y="185" width="225" height="25" fill="${boxColor}" />
      <text x="185" y="203" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${hazardLabel}</text>
    `;
  } else {
    hazardLabel = `PEDESTRIAN AT RISK`;
    boxColor = '#9333ea';
    hazardGraphic = `
      <!-- Pedestrian figure -->
      <circle cx="320" cy="240" r="14" fill="#64748b" />
      <path d="M312,256 L328,256 L332,300 L324,300 L320,275 L316,300 L308,300 Z" fill="#64748b" />
      <!-- Crosswalk striped line -->
      <line x1="160" y1="340" x2="480" y2="340" stroke="#f1f5f9" stroke-width="8" stroke-dasharray="30,20" />
      <!-- Bounding Box -->
      <rect x="280" y="210" width="80" height="110" fill="none" stroke="${boxColor}" stroke-width="2.5" stroke-dasharray="8,4" />
      <rect x="250" y="185" width="160" height="25" fill="${boxColor}" />
      <text x="255" y="203" fill="#ffffff" font-size="12" font-family="monospace" font-weight="bold">${hazardLabel}</text>
    `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="100%" height="100%">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#94a3b8" />
          <stop offset="45%" stop-color="#cbd5e1" />
          <stop offset="46%" stop-color="#475569" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>

      <!-- Road & Horizon Background -->
      <rect x="0" y="0" width="640" height="180" fill="#94a3b8" />
      <!-- City / Trees Silhouette -->
      <polygon points="0,180 80,140 140,165 220,130 300,160 380,145 460,168 540,135 640,175 640,180 0,180" fill="#64748b" opacity="0.6" />
      <!-- Pavement / Road Perspective -->
      <polygon points="0,400 240,180 400,180 640,400" fill="url(#roadGrad)" />
      <!-- Road Shoulders -->
      <polygon points="0,400 0,180 240,180" fill="#334155" opacity="0.5" />
      <polygon points="640,400 640,180 400,180" fill="#334155" opacity="0.5" />
      
      <!-- Lane Dash Markings -->
      <polygon points="316,180 324,180 326,220 314,220" fill="#f8fafc" opacity="0.8" />
      <polygon points="314,240 326,240 328,290 312,290" fill="#f8fafc" opacity="0.85" />
      <polygon points="310,315 330,315 334,380 306,380" fill="#f8fafc" opacity="0.9" />

      <!-- Hazard Simulation Graphic -->
      ${hazardGraphic}

      <!-- Bus Dash / Hood Bottom Accent -->
      <path d="M0,385 Q320,365 640,385 L640,400 L0,400 Z" fill="#0f172a" />
      <line x1="320" y1="365" x2="320" y2="395" stroke="#38bdf8" stroke-width="2" opacity="0.8" />

      <!-- HUD Watermarks & Overlay -->
      <rect x="15" y="15" width="280" height="52" rx="4" fill="#020617" opacity="0.75" />
      <text x="25" y="33" fill="#38bdf8" font-size="12" font-family="monospace" font-weight="bold">URBANNEX EDGE AI • CAM-01</text>
      <text x="25" y="55" fill="#f8fafc" font-size="11" font-family="monospace">${busId} • GPS: 11.0168° N, 76.9558° E</text>

      <rect x="395" y="15" width="230" height="52" rx="4" fill="#020617" opacity="0.75" />
      <text x="405" y="33" fill="#facc15" font-size="11" font-family="monospace" font-weight="bold">EVIDENCE ID: ${id}</text>
      <text x="405" y="55" fill="#94a3b8" font-size="11" font-family="monospace">${dateStr}</text>

      <!-- Center Optical Reticle -->
      <circle cx="320" cy="200" r="16" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.4" />
      <line x1="300" y1="200" x2="340" y2="200" stroke="#38bdf8" stroke-width="1" opacity="0.4" />
      <line x1="320" y1="180" x2="320" y2="220" stroke="#38bdf8" stroke-width="1" opacity="0.4" />

      <!-- Bottom Simulation Label Banner -->
      <rect x="140" y="368" width="360" height="24" rx="3" fill="#020617" opacity="0.85" />
      <text x="320" y="384" fill="#38bdf8" font-size="10" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="1">
        SIMULATED DEMO EVIDENCE • SINGLE FRAME TRANSMISSION
      </text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
