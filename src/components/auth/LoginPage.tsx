import React, { useState } from 'react';
import { ArrowRight, BusFront, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';

interface LoginPageProps {
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  onSubmit: (credentials: { name: string; email: string; password: string; accountType: 'main' | 'department'; department: Department }) => void | Promise<void>;
  onForgotPassword: (email: string) => Promise<{ developmentToken?: string; message?: string }>;
  onResetPassword: (email: string, token: string, password: string) => Promise<void>;
  errorMessage?: string;
  isSubmitting?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ mode, onModeChange, onSubmit, onForgotPassword, onResetPassword, errorMessage, isSubmitting = false }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'main' | 'department'>('department');
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (recoveryMode) {
      setRecoverySubmitting(true);
      setRecoveryError('');
      if (resetRequested) {
        void onResetPassword(recoveryEmail, resetToken, newPassword)
          .then(() => {
            setRecoveryMessage('Password updated. Sign in with your new password.');
            setRecoveryMode(false);
            setResetRequested(false);
            onModeChange('login');
          })
          .catch((error: unknown) => setRecoveryError(error instanceof Error ? error.message : 'Could not reset the password.'))
          .finally(() => setRecoverySubmitting(false));
      } else {
        void onForgotPassword(recoveryEmail)
          .then((result) => {
            setResetRequested(true);
            setRecoveryMessage(result.message || 'If an account exists, reset instructions have been sent.');
            if (result.developmentToken) setResetToken(result.developmentToken);
          })
          .catch((error: unknown) => setRecoveryError(error instanceof Error ? error.message : 'Could not request a reset token.'))
          .finally(() => setRecoverySubmitting(false));
      }
      return;
    }
    onSubmit({ name, email, password, accountType: mode === 'signup' ? 'department' : accountType, department });
  };

  return (
    <main className="auth-page min-h-screen bg-[#edf4f8] text-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="auth-shell w-full max-w-6xl min-h-[680px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,55,75,0.16)] grid lg:grid-cols-[1.08fr_0.92fr]">
        <section className="auth-visual relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#082f42] p-12 text-white">
          <div className="auth-grid absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(112, 202, 221, .16) 1px, transparent 1px), linear-gradient(90deg, rgba(112, 202, 221, .16) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
          <div className="auth-ring auth-ring-one absolute -right-24 -top-24 h-96 w-96 rounded-full border border-cyan-300/20" />
          <div className="auth-ring auth-ring-two absolute -right-8 -top-8 h-64 w-64 rounded-full border border-cyan-300/20" />
          <div className="auth-reveal auth-delay-1 relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-[#082f42] shadow-lg shadow-cyan-950/30">
              <BusFront className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">UrbanNex <span className="text-cyan-300">AI</span></p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/60">Urban intelligence network</p>
            </div>
          </div>

          <div className="auth-reveal auth-delay-2 relative z-10 max-w-lg">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-cyan-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live command center · SIH 2026
            </div>
            <h1 className="text-5xl font-black leading-[1.05] tracking-[-0.04em]">See the city move.<br /><span className="text-cyan-300">Respond in time.</span></h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">Coordinate a live fleet of mobile sensors, verify road intelligence, and move every civic incident from detection to resolution.</p>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {[['12', 'Active buses'], ['28.6', 'Edge FPS'], ['99.3%', 'Event health']].map(([value, label]) => (
                <div key={label} className="border-l border-cyan-200/20 pl-3">
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-reveal auth-delay-3 relative z-10 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-cyan-300" /> Privacy-first edge processing · Raw video upload off
          </div>
        </section>

        <section className="auth-form-panel flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="auth-reveal mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#082f42] text-cyan-300"><BusFront className="h-5 w-5" /></div>
              <p className="font-bold">UrbanNex <span className="text-cyan-600">AI</span></p>
            </div>
            <div className="auth-reveal auth-delay-1 mb-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Command authority access</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">{recoveryMode ? 'Reset your password.' : mode === 'login' ? 'Welcome back.' : 'Create your access.'}</h2>
              <p className="mt-2 text-sm text-slate-500">{recoveryMode ? 'Request a one-time reset token, then choose a new password.' : mode === 'login' ? 'Choose your authority desk and sign in.' : 'Request department access. Main branch approval is required.'}</p>
            </div>

            {!recoveryMode && <div className="auth-reveal auth-delay-2 mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              {(['login', 'signup'] as const).map((item) => (
                <button key={item} type="button" onClick={() => onModeChange(item)} className={`rounded-lg py-2.5 text-xs font-bold capitalize transition-all ${mode === item ? 'bg-white text-[#0b4b61] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {item === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>}

            {!recoveryMode && recoveryMessage && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">{recoveryMessage}</p>}
            <form onSubmit={handleSubmit} className="auth-reveal auth-delay-3 space-y-4">
              {recoveryMode ? (
                <>
                  <label className="block text-xs font-bold text-slate-700">Work email
                    <span className="relative mt-1.5 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="authority@urbannex.ai" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" /></span>
                  </label>
                  {resetRequested && <>
                    <label className="block text-xs font-bold text-slate-700">Reset token
                      <input required value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Paste the token from your reset email" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" />
                    </label>
                    <label className="block text-xs font-bold text-slate-700">New password
                      <input required minLength={4} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 4 characters" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" />
                    </label>
                  </>}
                  {recoveryMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">{recoveryMessage}</p>}
                  {recoveryError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{recoveryError}</p>}
                  <button type="submit" disabled={recoverySubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4b61] py-3.5 text-sm font-bold text-white disabled:opacity-60">{recoverySubmitting ? 'Please wait...' : resetRequested ? 'Set new password' : 'Send reset token'}</button>
                  <button type="button" onClick={() => { setRecoveryMode(false); setResetRequested(false); setRecoveryMessage(''); setRecoveryError(''); }} className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900">Back to sign in</button>
                </>
              ) : <>
              {mode === 'login' ? (
                <fieldset>
                  <legend className="mb-1.5 text-xs font-bold text-slate-700">Authority desk</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([['department', 'Department'], ['main', 'Main branch']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setAccountType(value)} aria-pressed={accountType === value} className={`rounded-lg border py-2.5 text-xs font-bold transition ${accountType === value ? 'border-cyan-700 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <label className="block text-xs font-bold text-slate-700">Department access requested
                  <select required value={department} onChange={(event) => setDepartment(event.target.value as Department)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10">
                    {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              )}
              {mode === 'signup' && (
                <label className="block text-xs font-bold text-slate-700">Full name
                  <span className="relative mt-1.5 block"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Priya Raman" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" /></span>
                </label>
              )}
              <label className="block text-xs font-bold text-slate-700">Work email
                <span className="relative mt-1.5 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="authority@urbannex.ai" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" /></span>
              </label>
              <label className="block text-xs font-bold text-slate-700">Password
                <span className="relative mt-1.5 block"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required minLength={4} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 4 characters" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm font-normal outline-none transition focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-2.5 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              </label>
              {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{errorMessage}</p>}
              <button type="submit" disabled={isSubmitting} className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4b61] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#0b4b61]/20 transition hover:bg-[#07394a] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Checking access...' : mode === 'login' ? 'Enter command center' : 'Create authority account'}{!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}</button>
              {mode === 'login' && <button type="button" onClick={() => { setRecoveryEmail(email); setRecoveryMode(true); setRecoveryMessage(''); setRecoveryError(''); }} className="w-full py-1 text-right text-xs font-semibold text-cyan-800 hover:text-cyan-950">Forgot password?</button>}
              </>}
            </form>
            <div className="auth-reveal auth-delay-4 mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-400"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Secure prototype access for authorized teams</div>
          </div>
        </section>
      </div>
    </main>
  );
};