import React from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';
import { Detection, Bus, RouteData } from '../../types';

interface AnalyticsPageProps {
  detections: Detection[];
  buses: Bus[];
  routes: RouteData[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  detections,
  buses,
  routes,
}) => {
  // 1. Potholes & Defects by Route
  const routeStats = routes.map((r) => {
    const routeDetections = detections.filter(d => d.routeId === r.id);
    return {
      name: r.routeNumber,
      fullName: r.name,
      total: routeDetections.length,
      critical: routeDetections.filter(d => d.severity === 'critical' || d.severity === 'high').length,
      potholes: routeDetections.filter(d => d.type === 'pothole').length,
    };
  });

  // 2. Anomaly Types Breakdown (Pie)
  const typeCounts: Record<string, number> = {};
  detections.forEach(d => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  });

  const typeData = [
    { name: 'Pothole', value: typeCounts['pothole'] || 0, color: '#ef4444' },
    { name: 'Waterlogging', value: typeCounts['waterlogging'] || 0, color: '#2563eb' },
    { name: 'Road Damage', value: typeCounts['road_damage'] || 0, color: '#ea580c' },
    { name: 'Congestion', value: typeCounts['congestion'] || 0, color: '#d97706' },
    { name: 'Pedestrian Risk', value: typeCounts['pedestrian_risk'] || 0, color: '#9333ea' },
  ].filter(d => d.value > 0);

  // 3. Hourly Detection Frequency (Simulated time buckets)
  const hourlyData = [
    { hour: '08:00', detections: 6, verified: 5 },
    { hour: '09:00', detections: 14, verified: 12 },
    { hour: '10:00', detections: 19, verified: 16 },
    { hour: '11:00', detections: 22, verified: 18 },
    { hour: '12:00', detections: 16, verified: 14 },
    { hour: '13:00', detections: 12, verified: 10 },
    { hour: '14:00', detections: 25, verified: 21 },
    { hour: '15:00', detections: 28, verified: 24 },
  ];

  // 4. Department Workload
  const deptCounts: Record<string, number> = {};
  detections.forEach(d => {
    if (d.department) {
      deptCounts[d.department] = (deptCounts[d.department] || 0) + 1;
    }
  });

  const deptData = Object.entries(deptCounts).map(([dept, count]) => ({
    name: dept.split(' ')[0],
    fullName: dept,
    incidents: count,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              City Infrastructure Analytics
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600">Smart City Corridor Insights</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Urban Analytics & Pavement Degradation Trends
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Longitudinal defect distribution, route vulnerability scores, and municipal department remediation velocity.
          </p>
        </div>
      </div>

      {/* Top Stat Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Most Vulnerable Corridor</span>
          <div className="text-lg font-bold text-slate-900 mt-1">Route 12 (Gandhipuram ↔ Airport)</div>
          <span className="text-xs text-red-600 font-semibold mt-0.5 block">High Pothole Concentration</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Verification Precision</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">94.8%</div>
          <span className="text-xs text-emerald-600 font-semibold mt-0.5 block">Zero False Positives in High SNR</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Mean Time to Dispatch</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">18 Mins</div>
          <span className="text-xs text-slate-500 font-medium mt-0.5 block">Down from 4.2 days traditional</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Municipal Cost Savings</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">72% Savings</div>
          <span className="text-xs text-slate-500 font-medium mt-0.5 block">Zero dedicated inspection cars</span>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Potholes by Transit Route */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hazard Density by Transit Route</h2>
              <p className="text-xs text-slate-500">Total detected anomalies vs. critical severity items</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">Pilot Ward</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="total" fill="#3b82f6" name="Total Defects" radius={[4, 4, 0, 0]} />
                <Bar dataKey="critical" fill="#ef4444" name="Critical / High" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hourly Detection Frequency */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hourly Anomaly Influx</h2>
              <p className="text-xs text-slate-500">Fleet telemetry intake rate across peak transit hours</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700">Today</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Area type="monotone" dataKey="detections" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDetections)" name="Flagged Detections" />
                <Area type="monotone" dataKey="verified" stroke="#10b981" strokeWidth={2} fillOpacity={0} name="Authority Verified" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Detection Types Distribution (Pie) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Anomaly Type Composition</h2>
              <p className="text-xs text-slate-500">Breakdown of classified hazard categories</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} 
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Department Action Load */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Department Caseload Allocation</h2>
              <p className="text-xs text-slate-500">Active remediation assignments across municipal bodies</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} 
                />
                <Bar dataKey="incidents" fill="#8b5cf6" name="Assigned Hazards" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
