import React, { useState } from 'react';
import { 
  Kanban, 
  CheckCircle2, 
  Clock, 
  Users, 
  PlayCircle, 
  CheckCheck, 
  MapPin, 
  Bus, 
  ArrowRight, 
  AlertTriangle,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Detection, IncidentStatus, Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';

interface WorkflowBoardProps {
  detections: Detection[];
  onSelectDetection: (d: Detection) => void;
  onVerify: (id: string) => void;
  onAssign: (id: string, department: Department, note?: string) => void;
  onInProgress: (id: string, note?: string) => void;
  onResolve: (id: string, notes?: string) => void;
}

export const WorkflowBoard: React.FC<WorkflowBoardProps> = ({
  detections,
  onSelectDetection,
  onVerify,
  onAssign,
  onInProgress,
  onResolve,
}) => {
  const [selectedDeptModal, setSelectedDeptModal] = useState<{ id: string } | null>(null);
  const [targetDept, setTargetDept] = useState<Department>('Roads & Infrastructure');
  const [departmentNote, setDepartmentNote] = useState('');

  const [resolveModal, setResolveModal] = useState<{ id: string } | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const columns: { id: IncidentStatus; title: string; desc: string; color: string }[] = [
    {
      id: 'pending_verification',
      title: 'Pending Verification',
      desc: 'Fresh Edge AI flags awaiting officer audit',
      color: 'border-yellow-300 bg-yellow-50/40 text-yellow-800',
    },
    {
      id: 'verified',
      title: 'Verified',
      desc: 'Confirmed genuine hazards by Authority',
      color: 'border-blue-300 bg-blue-50/40 text-blue-800',
    },
    {
      id: 'assigned',
      title: 'Assigned',
      desc: 'Dispatched to specialized municipal division',
      color: 'border-purple-300 bg-purple-50/40 text-purple-800',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      desc: 'Field repair and road teams mobilized',
      color: 'border-amber-300 bg-amber-50/40 text-amber-800',
    },
    {
      id: 'resolved',
      title: 'Resolved',
      desc: 'Civil repairs completed and signed off',
      color: 'border-emerald-300 bg-emerald-50/40 text-emerald-800',
    },
  ];

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Municipal Governance Workflow
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600">SIH 2026 Triage Model</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Authority Incident Lifecycle & Triage Kanban
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Track road defects from initial onboard camera flag to official municipal sign-off and repair verification.
          </p>
        </div>

        {/* Workflow Summary Pills */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className="px-3 py-1.5 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
            {detections.filter(d => d.status === 'pending_verification').length} Pending
          </div>
          <div className="px-3 py-1.5 bg-purple-50 text-purple-800 rounded-xl border border-purple-200">
            {detections.filter(d => d.status === 'assigned' || d.status === 'in_progress').length} In Operations
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
            {detections.filter(d => d.status === 'resolved').length} Resolved
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {columns.map((col) => {
          const colItems = detections.filter(d => d.status === col.id);

          return (
            <div
              key={col.id}
              className="bg-slate-50/80 rounded-2xl border border-slate-200 p-3 flex flex-col min-h-[550px] shadow-2xs"
            >
              {/* Column Header */}
              <div className="pb-3 mb-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-xs text-slate-900">{col.title}</h2>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${col.color}`}>
                    {colItems.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{col.desc}</p>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colItems.length === 0 ? (
                  <div className="py-12 text-center text-[11px] text-slate-400 font-medium">
                    No incidents in this stage
                  </div>
                ) : (
                  colItems.map((det) => (
                    <div
                      key={det.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all group"
                    >
                      {/* Top Tag & ID */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="font-mono font-bold text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {det.id}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${getSeverityBadge(det.severity)}`}>
                          {det.severity}
                        </span>
                      </div>

                      {/* Title & Type */}
                      <h3 className="font-bold text-xs text-slate-900 capitalize">
                        {det.type.replace('_', ' ')}
                      </h3>

                      {/* Location */}
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-tight flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span>{det.locationName}</span>
                      </p>

                      {/* Telemetry info */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Bus className="w-3 h-3 text-blue-600" />
                          {det.busId}
                        </span>
                        <span>Conf: {(det.confidence * 100).toFixed(0)}%</span>
                      </div>

                      {/* Department if assigned */}
                      {det.department && (
                        <div className="mt-1.5 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded truncate">
                          {det.department}
                        </div>
                      )}

                      {/* Action Advance Buttons */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {det.status === 'pending_verification' && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => onVerify(det.id)}
                              className="py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verify</span>
                            </button>
                            <button
                              onClick={() => setSelectedDeptModal({ id: det.id })}
                              className="py-1 text-[10px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                            >
                              Assign
                            </button>
                          </div>
                        )}

                        {det.status === 'verified' && (
                          <button
                            onClick={() => setSelectedDeptModal({ id: det.id })}
                            className="w-full py-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Users className="w-3 h-3" />
                            <span>Assign Department</span>
                          </button>
                        )}

                        {det.status === 'assigned' && (
                          <button
                            onClick={() => onInProgress(det.id, 'Road crew dispatched')}
                            className="w-full py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            <PlayCircle className="w-3 h-3" />
                            <span>Mobilize Field Unit</span>
                          </button>
                        )}

                        {det.status === 'in_progress' && (
                          <button
                            onClick={() => setResolveModal({ id: det.id })}
                            className="w-full py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Certify Resolved</span>
                          </button>
                        )}

                        {/* Evidence inspect link */}
                        <button
                          onClick={() => onSelectDetection(det)}
                          className="w-full py-1 text-[10px] font-semibold text-slate-500 hover:text-blue-600 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <span>Inspect Evidence Frame</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Department Assignment Modal */}
      {selectedDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setSelectedDeptModal(null)} 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs" 
          />
          <div className="relative bg-white rounded-2xl p-5 shadow-xl border border-slate-200 w-full max-w-md z-10 space-y-4">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Assign Municipal Department</h2>
              <p className="text-xs text-slate-500">Incident: {selectedDeptModal.id}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Department:</label>
                <select
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value as Department)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Instructions (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Expedite prior to evening peak hours..."
                  value={departmentNote}
                  onChange={(e) => setDepartmentNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedDeptModal(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onAssign(selectedDeptModal.id, targetDept, departmentNote);
                  setSelectedDeptModal(null);
                  setDepartmentNote('');
                }}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
              >
                Dispatch Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Sign-Off Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setResolveModal(null)} 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs" 
          />
          <div className="relative bg-white rounded-2xl p-5 shadow-xl border border-slate-200 w-full max-w-md z-10 space-y-4">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Sign Off Hazard Resolution</h2>
              <p className="text-xs text-slate-500">Incident: {resolveModal.id}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Field Inspection & Closure Notes:</label>
              <textarea
                rows={3}
                placeholder="e.g. Bituminous cold patch laid and rolled. Lane reopening certified by Field Inspector."
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolveModal(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResolve(resolveModal.id, resolutionText);
                  setResolveModal(null);
                  setResolutionText('');
                }}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Certify & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
