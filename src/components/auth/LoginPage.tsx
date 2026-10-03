import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  BusFront, 
  Eye, 
  EyeOff, 
  LockKeyhole, 
  Mail, 
  ShieldCheck, 
  UserRound, 
  Building2, 
  KeyRound, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';

const configuredBackendUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const backendUrl = configuredBackendUrl || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
function authApiUrl(path: string) {
  return `${backendUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

interface LoginPageProps {
  mode?: 'login' | 'signup';
  onModeChange?: (mode: 'login' | 'signup') => void;
  onSubmit: (credentials: { 
    name: string; 
    email: string; 
    password: string; 
    accountType: 'main' | 'department'; 
    department?: Department;
    action?: 'login' | 'signup';
    approvalBadge?: string;
  }) => void | Promise<any>;
  errorMessage?: string;
  successMessage?: string;
  isSubmitting?: boolean;
  onForgotPassword?: (email: string) => Promise<{ message?: string; resetToken?: string; developmentToken?: string; verificationCode?: string; emailSent?: boolean }>;
  onResetPassword?: (
    arg1: { token: string; email?: string; newPassword?: string; password?: string } | string,
    arg2?: string,
    arg3?: string
  ) => Promise<{ message?: string }>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  mode = 'login',
  onModeChange,
  onSubmit, 
  errorMessage, 
  successMessage,
  isSubmitting = false,
  onForgotPassword,
  onResetPassword
}) => {
  // Main view: 'auth' (login/signup) or 'forgot'
  const [view, setView] = useState<'auth' | 'forgot'>('auth');

  // Login / Signup mode
  const [activeMode, setActiveMode] = useState<'login' | 'signup'>(mode);

  // Authority desk switcher for login: 'department' or 'main'
  const [authorityDesk, setAuthorityDesk] = useState<'department' | 'main'>(() => {
    try {
      const last = localStorage.getItem('urbannex_last_login_email');
      if (last && last.toLowerCase() !== 'iamgokulvanan@gmail.com') return 'department';
      const regRaw = localStorage.getItem('urbannex_registered_authority');
      if (regRaw) {
        const reg = JSON.parse(regRaw);
        if (reg?.email && reg.email.toLowerCase() !== 'iamgokulvanan@gmail.com') return 'department';
      }
    } catch {}
    return 'main';
  });

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => {
    try {
      const last = localStorage.getItem('urbannex_last_login_email');
      if (last) return last;
      const regRaw = localStorage.getItem('urbannex_registered_authority');
      if (regRaw) {
        const reg = JSON.parse(regRaw);
        if (reg?.email) return reg.email;
      }
    } catch {}
    return 'iamgokulvanan@gmail.com';
  });
  const [password, setPassword] = useState(() => {
    try {
      const last = localStorage.getItem('urbannex_last_login_email');
      if (!last || last.toLowerCase() === 'iamgokulvanan@gmail.com') return 'gokul123@';
    } catch {}
    return '';
  });
  const [department, setDepartment] = useState<Department>(() => {
    try {
      const regRaw = localStorage.getItem('urbannex_registered_authority');
      if (regRaw) {
        const reg = JSON.parse(regRaw);
        if (reg?.department && DEPARTMENTS.includes(reg.department)) return reg.department;
        if (reg?.requestedDepartment && DEPARTMENTS.includes(reg.requestedDepartment)) return reg.requestedDepartment;
      }
    } catch {}
    return 'Roads & Infrastructure';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [approvalInfo, setApprovalInfo] = useState<{ isApproved: boolean; department?: Department; badge?: string } | null>(null);

  // Auto-detect approval status when officer email is provided
  useEffect(() => {
    if (activeMode !== 'login' || authorityDesk === 'main') {
      setApprovalInfo(null);
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail === 'iamgokulvanan@gmail.com') {
      setApprovalInfo(null);
      return;
    }

    // 1. Immediate local roster inspection
    try {
      const rawRoster = localStorage.getItem('urbannex_authority_approved_roster');
      if (rawRoster) {
        const list = JSON.parse(rawRoster);
        const match = list.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        if (match) {
          setApprovalInfo({ isApproved: true, department: match.department, badge: match.approvalBadge });
          if (match.department && DEPARTMENTS.includes(match.department)) {
            setDepartment(match.department);
          }
          return;
        }
      }
      const rawReg = localStorage.getItem('urbannex_registered_authority');
      if (rawReg) {
        const reg = JSON.parse(rawReg);
        if (reg?.email?.toLowerCase() === cleanEmail && (reg.approved === 1 || reg.approved === true)) {
          setApprovalInfo({ isApproved: true, department: reg.department, badge: reg.approvalBadge });
          if (reg.department && DEPARTMENTS.includes(reg.department)) {
            setDepartment(reg.department);
          }
          return;
        }
      }
    } catch {}

    // 2. Query backend approval-status API
    const timer = setTimeout(() => {
      fetch(authApiUrl(`/api/auth/approval-status?email=${encodeURIComponent(cleanEmail)}`))
        .then(res => {
          if (!res.ok) return null;
          return res.json();
        })
        .then(data => {
          if (data && data.approved) {
            setApprovalInfo({ isApproved: true, department: data.department, badge: data.approvalBadge });
            if (data.department && DEPARTMENTS.includes(data.department)) {
              setDepartment(data.department);
            }
          } else {
            setApprovalInfo(null);
          }
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [email, activeMode, authorityDesk]);

  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    setActiveMode(newMode);
    if (onModeChange) onModeChange(newMode);
    setView('auth');
    if (newMode === 'login') {
      if (email && email.toLowerCase() !== 'iamgokulvanan@gmail.com') {
        setAuthorityDesk('department');
        setPassword('');
      } else if (authorityDesk === 'main') {
        setEmail('iamgokulvanan@gmail.com');
        setPassword('gokul123@');
      } else {
        setEmail('roads@urbannex.ai');
        setPassword('roads123@');
      }
    } else {
      setName('');
      setPassword('');
    }
  };

  const handleDeskSwitch = (desk: 'department' | 'main') => {
    setAuthorityDesk(desk);
    if (desk === 'main') {
      setEmail('iamgokulvanan@gmail.com');
      setPassword('gokul123@');
      setApprovalInfo(null);
    } else {
      // If user typed a custom email, preserve it!
      if (email && email.toLowerCase() !== 'iamgokulvanan@gmail.com') {
        // preserve current officer email
      } else {
        let storedEmail = '';
        let storedDept: Department | null = null;
        try {
          const last = localStorage.getItem('urbannex_last_login_email');
          if (last && last.toLowerCase() !== 'iamgokulvanan@gmail.com') storedEmail = last;
          const regRaw = localStorage.getItem('urbannex_registered_authority');
          if (regRaw) {
            const reg = JSON.parse(regRaw);
            if (reg?.email && reg.email.toLowerCase() !== 'iamgokulvanan@gmail.com') {
              if (!storedEmail) storedEmail = reg.email;
              if (reg.department && DEPARTMENTS.includes(reg.department)) storedDept = reg.department;
            }
          }
        } catch {}
        if (storedEmail) {
          setEmail(storedEmail);
          if (storedDept) setDepartment(storedDept);
        } else {
          setEmail('roads@urbannex.ai');
          if (!password) setPassword('roads123@');
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeMode === 'login') {
      onSubmit({
        name: authorityDesk === 'main' ? 'Main Branch Authority' : `${department} Officer`,
        email: email.trim(),
        password,
        accountType: authorityDesk,
        department: authorityDesk === 'department' ? (approvalInfo?.department || department) : undefined,
        action: 'login',
        approvalBadge: approvalInfo?.badge,
      });
    } else {
      onSubmit({
        name: name.trim() || `${department} Officer`,
        email: email.trim(),
        password,
        accountType: 'department',
        department,
        action: 'signup',
      });
    }
  };

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotNotice('');
    try {
      if (onForgotPassword) {
        const data = await onForgotPassword(forgotEmail.trim());
        const token = data.verificationCode || data.resetToken || data.developmentToken;
        if (token) {
          setResetToken(token);
        }
        setForgotNotice(
          data.message || 
          (data.emailSent 
            ? `Verification code dispatched to ${forgotEmail}. Please check your email inbox.` 
            : `Verification code generated for ${forgotEmail}.`)
        );
        setForgotStep(2);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Could not send verification token. Verify email address.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleApplyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !resetToken || !newPassword) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotNotice('');
    try {
      if (onResetPassword) {
        const data = await onResetPassword({
          email: forgotEmail.trim(),
          token: resetToken.trim(),
          newPassword,
          password: newPassword,
        });
        setForgotNotice(data?.message || 'Password updated successfully! Logging you into Command Center...');
        setTimeout(() => {
          setPassword(newPassword);
          setEmail(forgotEmail);
          setView('auth');
          setActiveMode('login');
          setForgotStep(1);
          setForgotNotice('');
          setForgotError('');
        }, 800);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Could not reset password. Check your verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-4 md:p-8 selection:bg-cyan-200">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_20px_70px_rgba(8,35,46,0.18)] border border-slate-200/80 grid lg:grid-cols-[1.1fr_1fr]">
        
        {/* Left Visual Brand Panel */}
        <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#06242e] p-10 xl:p-12 text-white select-none">
          {/* Subtle Grid Background */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.18) 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }} 
          />

          {/* Decorative Radar Orbital Rings */}
          <div className="absolute -right-20 -top-20 w-84 h-84 rounded-full border border-cyan-400/20 pointer-events-none" />
          <div className="absolute -right-6 -top-6 w-56 h-56 rounded-full border border-cyan-400/25 pointer-events-none" />
          <div className="absolute right-8 top-8 w-28 h-28 rounded-full border border-cyan-400/30 pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-[#06242e] shadow-md shadow-cyan-950/40">
              <BusFront className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white leading-none">
                UrbanNex <span className="text-cyan-400">Ai</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60 mt-1">
                Urban Intelligence Network
              </p>
            </div>
          </div>

          {/* Center Brand Headline */}
          <div className="relative z-10 my-auto py-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/50 px-3.5 py-1 text-xs font-medium text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live command center - SIH 2026
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.12] tracking-tight text-white">
              See the city move.<br />
              <span className="text-cyan-400">Respond in time.</span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-slate-300 max-w-md">
              Coordinate a live fleet of mobile sensors, verify road intelligence, and move every civic incident from detection to resolution.
            </p>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-6 mt-10 pt-6 border-t border-cyan-400/15">
              <div>
                <p className="text-2xl xl:text-3xl font-bold text-white tracking-tight">12</p>
                <p className="text-xs text-slate-400 mt-0.5">Active buses</p>
              </div>
              <div>
                <p className="text-2xl xl:text-3xl font-bold text-white tracking-tight">28.6</p>
                <p className="text-xs text-slate-400 mt-0.5">Edge FPS</p>
              </div>
              <div>
                <p className="text-2xl xl:text-3xl font-bold text-white tracking-tight">99.3%</p>
                <p className="text-xs text-slate-400 mt-0.5">Event health</p>
              </div>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>Privacy-first edge processing · Raw video upload off</span>
          </div>
        </section>

        {/* Right Panel: Clean Authority Form */}
        <section className="flex flex-col justify-center p-8 sm:p-10 lg:p-12 bg-white">
          <div className="w-full max-w-sm mx-auto">
            
            {/* Tagline & Headers */}
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">
              COMMAND AUTHORITY ACCESS
            </p>

            {view === 'forgot' ? (
              <>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Reset password.
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-6">
                  {forgotStep === 1 
                    ? 'Enter your registered work email to receive a reset token.' 
                    : 'Enter the verification token and choose a new password.'}
                </p>

                {forgotError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 font-medium">
                    {forgotError}
                  </div>
                )}

                {forgotNotice && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 font-medium">
                    <p className="font-bold">{forgotNotice}</p>
                  </div>
                )}

                {forgotStep === 1 ? (
                  <form onSubmit={handleRequestToken} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="e.g. iamgokulvanan@gmail.com"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full rounded-xl bg-[#083344] hover:bg-[#06242e] text-white py-3 text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {forgotLoading ? 'Dispatching token...' : 'Send verification token'}
                      {!forgotLoading && <ArrowRight className="h-4 w-4" />}
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => { setView('auth'); setForgotStep(1); setForgotError(''); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to log in
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleApplyReset} className="space-y-4">
                    {resetToken && (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 p-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">Verification Code</p>
                          <p className="font-mono text-sm font-extrabold tracking-widest text-cyan-950 mt-0.5">{resetToken}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(resetToken);
                            setForgotNotice('Verification code copied to clipboard!');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-cyan-100/60 border border-cyan-200 text-cyan-900 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        >
                          Copy Code
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">6-Digit Verification Code</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          type="text"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Enter 6-digit code or paste token"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs font-mono font-bold tracking-wider text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">New password</label>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          minLength={4}
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new secure password"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {forgotLoading ? 'Updating password...' : 'Update Password & Enter Command Center'}
                      {!forgotLoading && <CheckCircle2 className="h-4 w-4" />}
                    </button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => { setView('auth'); setForgotStep(1); setForgotError(''); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to log in
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  {activeMode === 'login' ? 'Welcome back.' : 'Create account.'}
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  {activeMode === 'login' 
                    ? 'Choose your authority desk and sign in.' 
                    : 'Register official municipal authority access.'}
                </p>

                {/* Log In / Sign Up Mode Pill Switcher */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 mb-5">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('login')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeMode === 'login' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('signup')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeMode === 'signup' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Form starts */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {activeMode === 'login' ? (
                    <>
                      {/* Authority Desk Switcher: Department vs Main Branch */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">Authority desk</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeskSwitch('department')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                              authorityDesk === 'department'
                                ? 'border-2 border-cyan-600 bg-cyan-50/50 text-cyan-950'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            Department
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeskSwitch('main')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                              authorityDesk === 'main'
                                ? 'border-2 border-cyan-600 bg-cyan-50/50 text-cyan-950'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            Main branch
                          </button>
                        </div>
                      </div>

                      {/* If Department selected, choose department */}
                      {authorityDesk === 'department' && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authority category</label>
                          <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value as Department)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          >
                            {DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Work Email */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                          <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={authorityDesk === 'main' ? 'iamgokulvanan@gmail.com' : 'roads@urbannex.ai'}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                        <div className="relative">
                          <LockKeyhole className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                          <input
                            required
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* SIGNUP MODE: Authority Category, Name, Email, Password only (Real World) */
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authority category</label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value as Department)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                        >
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
                        <div className="relative">
                          <UserRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                          <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Officer / Engineer name"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                          <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="official@urbannex.ai"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                        <div className="relative">
                          <LockKeyhole className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                          <input
                            required
                            minLength={4}
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create password"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Feedback Messages */}
                  {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  {successMessage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 font-medium">
                      {successMessage}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-[#083344] hover:bg-[#06242e] text-white py-3.5 text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting 
                      ? 'Processing...' 
                      : activeMode === 'login' 
                        ? 'Enter command center' 
                        : 'Create authority account'}
                    {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                  </button>

                  {/* Forgot Password Link on Login Mode */}
                  {activeMode === 'login' && (
                    <div className="text-right pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setView('forgot');
                          setForgotEmail(email);
                          setForgotStep(1);
                          setForgotError('');
                          setForgotNotice('');
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-cyan-700 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Clean bottom note */}
                  <div className="pt-3 text-center">
                    <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Secure prototype access for authorized teams
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};