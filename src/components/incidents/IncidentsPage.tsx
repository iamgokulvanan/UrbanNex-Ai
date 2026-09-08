import React, { useState } from 'react';
import { 
  AlertOctagon, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Users, 
  ArrowUpDown,
  MapPin,
  Bus
} from 'lucide-react';
import { Detection, DetectionType, SeverityLevel, IncidentStatus, Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';

interface IncidentsPageProps {
  detections: Detection[];
  onSelectDetection: (d: Detection) => void;
  onVerify: (id: string) => void;
  onResolve: (id: string) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  detections,
  onSelectDetection,
  onVerify,
  onResolve,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<DetectionType | 'all'>('all');

  const filtered = detections.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
    if (deptFilter !== 'all' && (d.department || 'Unassigned') !== deptFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        d.id.toLowerCase().includes(q) ||
        d.locationName.toLowerCase().includes(q) ||
        d.busId.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['IncidentID', 'Type', 'Severity', 'Confidence', 'BusID', 'Route', 'Latitude', 'Longitude', 'Location', 'Status', 'Department', 'Timestamp'];
    const rows = filtered.map(d => [
      d.id,
      d.type,
      d.severity,
      d.confidence.toFixed(3),
      d.busId,
      d.routeId,
      d.latitude,
      d.longitude,
      `"${d.locationName.replace(/"/g, '""')}"`,
      d.status,
      `"${(d.department || 'Unassigned').replace(/"/g, '""')}"`,
      d.timestamp
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `UrbanNex_Incidents_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (sev: SeverityLevel) => {
    switch (sev) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getStatusBadge = (st: IncidentStatus) => {
    switch (st) {
      case 'resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'verified': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'assigned': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'in_progress': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              Municipal Hazard Registry
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600">{filtered.length} Indexed Anomalies</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Incident Management & Resolution Records
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Central audit log of all pavement defects, flooding risks, and traffic bottlenecks detected by the bus fleet.
          </p>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search incident ID, street, bus..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Anomaly Types</option>
            <option value="pothole">Pothole</option>
            <option value="waterlogging">Waterlogging</option>
            <option value="road_damage">Road Damage</option>
            <option value="congestion">Traffic Congestion</option>
            <option value="pedestrian_risk">Pedestrian Risk</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Reporting Bus</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No incidents matching query.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr 
                    key={d.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => onSelectDetection(d)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {d.id}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 capitalize">
                      {d.type.replace('_', ' ')}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(d.severity)}`}>
                        {d.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {(d.confidence * 100).toFixed(1)}%
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{d.busId}</span>
                      <span className="text-[10px] text-slate-400 block">{d.routeId}</span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {d.locationName}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                      {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {d.department || 'Unassigned'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadge(d.status)}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDetection(d);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
