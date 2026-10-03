import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  Send, 
  Mail, 
  UserCheck, 
  Kanban, 
  RefreshCw, 
  Check,
  Activity,
  Search,
  Calendar,
  Clock,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Detection, Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';
import { NavTab } from '../layout/Sidebar';

export interface AuthorityManagementPageProps {
  detections?: Detection[];
  authorityRequests?: Array<{ id: number; name: string; email: string; requestedDepartment: Department | null; createdAt: string }>;
  requests?: Array<{ id: number; name: string; email: string; requestedDepartment: Department | null; createdAt: string }>;
  authorityRoster?: Array<{ id: number | string; name: string; email: string; role: string; department: Department | null; createdAt?: string }>;
  roster?: Array<{ id: number | string; name: string; email: string; role: string; department: Department | null; createdAt?: string }>;
  authorityActivity?: Array<{ id: number | string; payload: string; createdAt: string }>;
  activity?: Array<{ id: number | string; payload: string; createdAt: string }>;
  userRole?: 'main' | 'department';
  userDepartment?: Department | null;
  onApproveRequest: (id: number, department: Department) => any | Promise<any>;
  onAssignDepartment?: (detectionId: string, department: Department, note?: string) => void | Promise<void>;
  onRerouteDetection?: (detectionId: string, department: Department, note?: string) => void | Promise<void>;
  onSelectDetection?: (detection: Detection) => void;
  onNavigateTab?: (tab: NavTab) => void;
  onRefresh?: () => void | Promise<void>;
  error?: string;
  notice?: string;
}

export const AuthorityManagementPage: React.FC<AuthorityManagementPageProps> = (props) => {
  const userRole = props.userRole || 'main';
  const userDepartment = props.userDepartment;
  const detections = props.detections || [];
  const authorityRequests = props.authorityRequests || props.requests || [];
  const authorityRoster = props.authorityRoster || props.roster || [];
  const authorityActivity = props.authorityActivity || props.activity || [];
  const onApproveRequest = props.onApproveRequest;
  const onAssignDepartment = props.onAssignDepartment || props.onRerouteDetection || (() => {});
  const onNavigateTab = props.onNavigateTab || (() => {});
  const onRefresh = props.onRefresh;
  const error = props.error;
  const notice = props.notice;

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(detections[0]?.id || '');
  const [targetDepartment, setTargetDepartment] = useState<Department>('Roads & Infrastructure');
  const [dispatchNote, setDispatchNote] = useState<string>('');
  const [dispatchSuccess, setDispatchSuccess] = useState<string>('');
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [lastApprovalNotice, setLastApprovalNotice] = useState<{
    name: string;
    email: string;
    department: Department;
    time: string;
    emailSent?: boolean;
    transport?: string;
    previewUrl?: string;
    subject?: string;
    text?: string;
  } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const selectedIncident = detections.find(d => d.id === selectedIncidentId);

  const handleManualDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId) return;
    try {
      await onAssignDepartment(selectedIncidentId, targetDepartment, dispatchNote);
      setDispatchSuccess(`Incident ${selectedIncidentId} successfully routed to ${targetDepartment}!`);
      setDispatchNote('');
      setTimeout(() => setDispatchSuccess(''), 4000);
    } catch {
      // Handled by parent error state
    }
  };

  const handleApprove = async (id: number) => {
    const sel = document.getElementById(`dept-select-${id}`) as HTMLSelectElement | null;
    const chosenDept = (sel?.value as Department) || DEPARTMENTS[0];
    const targetReq = authorityRequests.find(r => r.id === id);
    setApprovingId(id);
    try {
      const result = await onApproveRequest(id, chosenDept);
      const officerName = result?.approvalDetails?.officerName || targetReq?.name || 'Officer';
      const officerEmail = result?.approvalDetails?.officerEmail || targetReq?.email || '';
      const transport = result?.transport || result?.approvalDetails?.transport || 'Automatic Dispatch Engine';
      const previewUrl = result?.previewUrl || result?.approvalDetails?.previewUrl;
      const subject = result?.approvalSubject || `[UrbanNex Official] Department Access Approved - Welcome to ${chosenDept}`;
      const text = result?.approvalText || '';

      setLastApprovalNotice({
        name: officerName,
        email: officerEmail,
        department: chosenDept,
        time: new Date().toLocaleTimeString(),
        emailSent: result?.emailSent ?? true,
        transport,
        previewUrl,
        subject,
        text,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleTriggerRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Department metadata
  const departmentOfficers: Record<Department, { officer: string; email: string; desc: string }> = {
    'Roads & Infrastructure': {
      officer: 'Eng. K. Rajesh',
      email: 'roads@urbannex.ai',
      desc: 'Pavement patching, structural cracks, asphalt overlay',
    },
    'Water & Drainage': {
      officer: 'Officer M. Senthil',
      email: 'water@urbannex.ai',
      desc: 'Stormwater basins, culvert blockages, pump deployment',
    },
    'Traffic Management': {
      officer: 'Inspector P. Kumar',
      email: 'traffic@urbannex.ai',
      desc: 'Signal split extension, intersection bottlenecks, wardens',
    },
    'Public Safety': {
      officer: 'Officer R. Anand',
      email: 'safety@urbannex.ai',
      desc: 'Pedestrian safety, crossing barricades, hazard signage',
    },
    'Emergency Response': {
      officer: 'Captain S. Vijay',
      email: 'emergency@urbannex.ai',
      desc: 'Rapid disaster relief, severe road collapses, night response',
    },
  };

  const filteredRoster = authorityRoster.filter(user => {
    const term = rosterSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      (user.department && user.department.toLowerCase().includes(term)) ||
      user.role.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          {userRole === 'department' ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 mb-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" /> {userDepartment ? `${userDepartment} Authority Desk` : 'Municipal Authority Portal'}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Main Branch Executive Administration
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Authority Access & Problem Dispatch</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Inspect municipal authority rosters, review department workloads, approve new officer access requests, and route urban transit problems to suitable specialized divisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              type="button"
              onClick={handleTriggerRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-xs text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Refresh authority roster and pending requests"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          )}

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-semibold text-slate-600">
            <span className="text-slate-400">Main Branch Admin: </span>
            <span className="font-bold text-slate-900 font-mono">iamgokulvanan@gmail.com</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {lastApprovalNotice && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl shadow-sm space-y-3.5 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2">
                  Official Department Access Clearance Dispatched
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800">
                    Live Dispatch
                  </span>
                </h3>
                <p className="text-[11px] text-emerald-700 font-medium">
                  {lastApprovalNotice.transport 
                    ? `Dispatched via ${lastApprovalNotice.transport} with login credentials & clearance certificate`
                    : 'Clearance certificate & login instructions delivered to officer email'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 bg-emerald-200/70 text-emerald-900 rounded-lg font-bold self-start sm:self-auto">
              {lastApprovalNotice.time}
            </span>
          </div>

          <div className="p-3.5 bg-white/95 rounded-xl border border-emerald-200 text-xs font-mono text-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Officer Name</span>
              <strong className="text-slate-900 font-bold">{lastApprovalNotice.name}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Dispatched To</span>
              <strong className="text-emerald-700 font-bold break-all">{lastApprovalNotice.email}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Assigned Division</span>
              <strong className="text-indigo-700 font-bold">{lastApprovalNotice.department}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Access Status</span>
              <strong className="text-emerald-700 font-bold">Active (Immediate Login Enabled)</strong>
            </div>
          </div>

          {/* Quick Actions for Director */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={`mailto:${lastApprovalNotice.email}?subject=${encodeURIComponent(lastApprovalNotice.subject || `[UrbanNex Official] Department Access Approved - Welcome to ${lastApprovalNotice.department}`)}&body=${encodeURIComponent(lastApprovalNotice.text || `Dear Officer ${lastApprovalNotice.name},\n\nYour official application for municipal authority access has been REVIEWED and APPROVED for ${lastApprovalNotice.department}.\n\nYou can now log in anytime at the UrbanNex Command Portal.`)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Open in Gmail / Email Client
            </a>

            <button
              type="button"
              onClick={() => {
                const textToCopy = lastApprovalNotice.text || `Official Clearance Approved\nOfficer: ${lastApprovalNotice.name}\nEmail: ${lastApprovalNotice.email}\nDepartment: ${lastApprovalNotice.department}\nStatus: Active`;
                navigator.clipboard.writeText(textToCopy);
                setCopiedNotice(true);
                setTimeout(() => setCopiedNotice(false), 3000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copiedNotice ? 'Letter Copied to Clipboard!' : 'Copy Clearance Letter'}
            </button>

            {lastApprovalNotice.previewUrl && (
              <a
                href={lastApprovalNotice.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Dispatched Email Preview
              </a>
            )}
          </div>
        </div>
      )}

      {/* 5 Department Operational Division Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" /> Municipal Authority Divisions
          </h2>
          <span className="text-xs text-slate-500 font-medium">5 Operational Civic Desks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {DEPARTMENTS.map((dept) => {
            const info = departmentOfficers[dept];
            const deptIncidents = detections.filter(d => d.department === dept);
            const assignedCount = deptIncidents.filter(d => d.status === 'assigned').length;
            const inProgressCount = deptIncidents.filter(d => d.status === 'in_progress').length;
            const resolvedCount = deptIncidents.filter(d => d.status === 'resolved').length;

            return (
              <div 
                key={dept}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md truncate max-w-[140px]">
                      {dept}
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-500">
                      {deptIncidents.length} total
                    </span>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 leading-snug">{dept}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">{info.desc}</p>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Chief Officer:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[120px]">{info.officer}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Desk Email:</span>
                      <span className="font-mono text-slate-600 truncate max-w-[120px]">{info.email}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px] py-1 bg-slate-50 rounded-xl mb-2">
                    <div>
                      <p className="font-black text-purple-700">{assignedCount}</p>
                      <p className="text-[9px] text-slate-400 uppercase">Assigned</p>
                    </div>
                    <div>
                      <p className="font-black text-amber-600">{inProgressCount}</p>
                      <p className="text-[9px] text-slate-400 uppercase">Working</p>
                    </div>
                    <div>
                      <p className="font-black text-emerald-600">{resolvedCount}</p>
                      <p className="text-[9px] text-slate-400 uppercase">Solved</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateTab('workflow')}
                    className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Kanban className="w-3.5 h-3.5" /> View Work Orders
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Manual Problem Dispatch & Rerouting Tool */}
      <section className="bg-white border-2 border-blue-100 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" /> Dispatch / Route Problem to Suitable Authority
            </h2>
            <p className="text-xs text-slate-500">Assign unallocated incidents or reroute existing problems to any municipal department</p>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Real-Time Authority Routing
          </span>
        </div>

        {dispatchSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dispatchSuccess}</span>
          </div>
        )}

        <form onSubmit={handleManualDispatch} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-slate-700">Select Civic Incident / Problem</label>
            <select
              value={selectedIncidentId}
              onChange={(e) => {
                setSelectedIncidentId(e.target.value);
                const item = detections.find(d => d.id === e.target.value);
                if (item?.department) setTargetDepartment(item.department);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {detections.slice(0, 40).map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.id}] {d.type.replace('_', ' ').toUpperCase()} · {d.locationName} ({d.department || 'Unassigned'})
                </option>
              ))}
            </select>
            {selectedIncident && (
              <p className="text-[11px] text-slate-400">
                Current Status: <strong className="text-slate-700 uppercase">{selectedIncident.status.replace('_', ' ')}</strong> · Assigned to: <strong className="text-slate-700">{selectedIncident.department || 'None'}</strong>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Target Authority Department</label>
            <select
              value={targetDepartment}
              onChange={(e) => setTargetDepartment(e.target.value as Department)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Officer: {departmentOfficers[targetDepartment]?.officer}
            </p>
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Dispatch to Department
            </button>
          </div>
        </form>
      </section>

      {/* Pending Access Requests Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Pending Department Access Requests
            </h2>
            <p className="text-xs text-slate-500">Municipal personnel requesting access to department problem desks</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
            {authorityRequests.length} Pending Approval
          </span>
        </div>

        {authorityRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-medium">
            No department access requests waiting for review. All registered officers are verified.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {authorityRequests.map((request) => (
              <div key={request.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">{request.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      ID #{request.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                      <Clock className="w-3 h-3" />
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{request.email}</p>
                  <p className="text-xs text-slate-600">
                    Requested Department: <strong className="text-indigo-700">{request.requestedDepartment || 'Not specified'}</strong>
                  </p>
                </div>

                {userRole === 'main' ? (
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <select 
                      id={`dept-select-${request.id}`}
                      defaultValue={request.requestedDepartment || DEPARTMENTS[0]}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={approvingId === request.id}
                      onClick={() => handleApprove(request.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {approvingId === request.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Assign</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="self-start sm:self-center px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                    Awaiting Director Clearance
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Authority Directory / Roster */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> Active Municipal Authority Directory
            </h2>
            <p className="text-xs text-slate-500">Official registered personnel stored in the database with active access to department problem workflows</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search authority roster..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-60"
              />
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full shrink-0">
              {authorityRoster.length} Stored Accounts
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Officer / Name</th>
                <th className="py-3 px-3">Email Address</th>
                <th className="py-3 px-3">Role / Authority Desk</th>
                <th className="py-3 px-3">Registered / Joined</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRoster.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span>{user.name}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">{user.email}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      user.role === 'main' 
                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                        : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    }`}>
                      {user.role === 'main' ? 'Main Branch Executive' : (user.department || 'Department Authority')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active & Verified
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRoster.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No matching authority personnel found in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Authority Login Activity & Notification Log */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" /> Authority Login Activity & Notification Logs
            </h2>
            <p className="text-xs text-slate-500">Real-time audit log of department sign-ins with email delivery alerts to iamgokulvanan@gmail.com</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Database Persisted</span>
        </div>

        {authorityActivity.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">
            Recent authority logins will appear here automatically.
          </div>
        ) : (
          <div className="space-y-2">
            {authorityActivity.map((event, idx) => {
              let parsed: any = {};
              try {
                parsed = JSON.parse(event.payload);
              } catch {
                parsed = { name: 'Authority User', email: 'authority@urbannex.ai' };
              }

              const isApprovalDispatch = event.payload.includes('approval_dispatched') || parsed.subject?.includes('Approved') || Boolean(parsed.recipient);
              const isAccessRequested = event.payload.includes('access_requested') || parsed.subject?.includes('Request Submitted');

              return (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isApprovalDispatch 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : (isAccessRequested ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-700')
                    }`}>
                      {isApprovalDispatch ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      {isApprovalDispatch ? (
                        <>
                          <p className="font-bold text-slate-800">
                            Clearance Email Dispatched: {parsed.officerName || 'Officer'} ({parsed.recipient})
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Approved Division: <strong className="text-emerald-700">{parsed.department}</strong> · Approved by: <strong>{parsed.approvedBy || 'Director Gokulvanan'}</strong> · Official clearance sent to officer email
                          </p>
                        </>
                      ) : isAccessRequested ? (
                        <>
                          <p className="font-bold text-slate-800">
                            Authority Access Request: {parsed.officerName || 'Officer'} ({parsed.email})
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Requested Division: <strong className="text-indigo-700">{parsed.requestedDepartment || 'General Department'}</strong> · Notification alert dispatched to <strong>iamgokulvanan@gmail.com</strong>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-slate-800">
                            {parsed.name} ({parsed.email}) signed in to <span className="text-purple-700 font-bold">{parsed.department || 'Main Branch Command'}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Notification alert dispatched to <strong>iamgokulvanan@gmail.com</strong>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {new Date(parsed.timestamp || event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
