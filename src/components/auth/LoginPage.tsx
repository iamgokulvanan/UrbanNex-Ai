import React, { useState } from 'react';
import { 
  ArrowRight, 
  BusFront, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  LockKeyhole, 
  Mail, 
  ShieldCheck, 
  UserRound, 
  Building2, 
  KeyRound, 
  Sparkles, 
  ChevronLeft,
  AlertCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { Department } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';

interface LoginPageProps {
  onSubmit: (credentials: { 
    name: string; 
    email: string; 
    password: string; 
    accountType: 'main' | 'department'; 
    department?: Department 
  }) => void | Promise<void>;
  errorMessage?: string;
  isSubmitting?: boolean;
  onForgotPassword?: (email: string) => Promise<{ message?: string; resetToken?: string; developmentToken?: string }>;
  onResetPassword?: (email: string, token: string, newPassword: string) => Promise<{ message?: string }>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  onSubmit, 
  errorMessage, 
  isSubmitting = false,
  onForgotPassword,
  onResetPassword
}) => {
  // Main Branch vs Authority Desk switcher
  const [accountType, setAccountType] = useState<'main' | 'department'>('main');
  
  // Department sub-mode: login or register
  const [deptMode, setDeptMode] = useState<'login' | 'register'>('login');

  // Forgot password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department>('Roads & Infrastructure');
  const [showPassword, setShowPassword] = useState(false);

  // Pre-fill helper
  const handleQuickFillMain = () => {
    setAccountType('main');
    setEmail('iamgokulvanan@gmail.com');
    setPassword('gokul123@');
    setName('Main Branch Director');
  };

  const handleQuickFillDept = (dept: Department, emailStr: string, pass: string) => {
    setAccountType('department');
    setDeptMode('login');
    setSelectedDepartment(dept);
    setEmail(emailStr);
    setPassword(pass);
    setName(`${dept} Officer`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ 
      name: name || (accountType === 'main' ? 'Main Branch Commander' : `${selectedDepartment} Officer`), 
      email: email.trim(), 
      password, 
      accountType, 
      department: accountType === 'department' ? selectedDepartment : undefined 
    });
  };

  const handleRequestResetToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');
    try {
      if (onForgotPassword) {
        const data = await onForgotPassword(forgotEmail);
        const token = data.resetToken || data.developmentToken;
        if (token) {
          setResetToken(token);
          setForgotMessage(data.message || 'Reset token generated successfully.');
        } else {
          setForgotMessage(data.message || 'Password reset instructions sent to your email.');
        }
        setForgotStep(2);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Could not request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleApplyNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !resetToken || !newPassword) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');
    try {
      if (onResetPassword) {
        const data = await onResetPassword(forgotEmail, resetToken, newPassword);
        setForgotMessage(data.message || 'Password successfully updated! You can now sign in.');
        setTimeout(() => {
          setShowForgotPassword(false);
          setPassword(newPassword);
          setEmail(forgotEmail);
          setForgotStep(1);
          setForgotMessage('');
        }, 1500);
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to update password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="auth-page min-h-screen bg-[#edf4f8] text-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="auth-shell w-full max-w-6xl min-h-[720px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,55,75,0.16)] grid lg:grid-cols-[1fr_1.05fr]">
        
        {/* Visual Brand Left Panel */}
        <section className="auth-visual relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#082f42] p-12 text-white">
          <div className="auth-grid absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(112, 202, 221, .16) 1px, transparent 1px), linear-gradient(90deg, rgba(112, 202, 221, .16) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
          <div className="auth-ring auth-ring-one absolute -right-24 -top-24 h-96 w-96 rounded-full border border-cyan-300/20" />
          <div className="auth-ring auth-ring-two absolute -right-8 -top-8 h-64 w-64 rounded-full border border-cyan-300/20" />
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-[#082f42] shadow-lg shadow-cyan-950/30">
              <BusFront className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">UrbanNex <span className="text-cyan-300">AI</span></p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/60">Urban Intelligence Command</p>
            </div>
          </div>

          <div className="relative z-10 max-w-lg">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-cyan-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> SIH 2026 · Role-Based Authority Access
            </div>
            <h1 className="text-4xl xl:text-5xl font-black leading-[1.08] tracking-tight">
              One City Fleet.<br />
              <span className="text-cyan-300">Dedicated Authority Desks.</span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-slate-300">
              Centralized city command for Main Branch leadership with isolated, department-level problem routing and solve workflows for specialized municipal divisions.
            </p>

            {/* Quick Authority Roster Info */}
            <div className="mt-8 pt-6 border-t border-cyan-200/20 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Main Branch Command
                </p>
                <p className="text-[11px] text-slate-300 mt-1">Full city fleet surveillance, verification, and authority roster management.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Authority Desks
                </p>
                <p className="text-[11px] text-slate-300 mt-1">Direct access to department problems, field crew mobilization, and incident resolution.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-cyan-300" /> Real-time database persistence & multi-channel alert logging
          </div>
        </section>

        {/* Auth Form Right Panel */}
        <section className="auth-form-panel flex items-center justify-center p-6 sm:p-10 lg:p-12 overflow-y-auto">
          <div className="w-full max-w-md space-y-6">

            {/* Mobile Header */}
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#082f42] text-cyan-300">
                <BusFront className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">UrbanNex <span className="text-cyan-600">AI</span></p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Command Authority Portal</p>
              </div>
            </div>

            {/* Forgot Password View */}
            {showForgotPassword ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setForgotStep(1); setForgotError(''); }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </button>

                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {forgotStep === 1 
                      ? 'Enter your registered email address to receive your password reset verification token.' 
                      : 'Enter the verification token and choose your new password.'}
                  </p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    {forgotError}
                  </div>
                )}

                {forgotMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium space-y-1">
                    <p className="font-bold">{forgotMessage}</p>
                    {resetToken && forgotStep === 2 && (
                      <p className="font-mono text-[11px] bg-emerald-100/60 p-1.5 rounded border border-emerald-300">
                        Token: {resetToken}
                      </p>
                    )}
                  </div>
                )}

                {forgotStep === 1 ? (
                  <form onSubmit={handleRequestResetToken} className="space-y-4">
                    <label className="block text-xs font-bold text-slate-700">Account Email
                      <span className="relative mt-1.5 block">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="e.g. iamgokulvanan@gmail.com"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                        />
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-3.5 bg-[#0b4b61] hover:bg-[#07394a] text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {forgotLoading ? 'Generating token...' : 'Request Reset Token'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleApplyNewPassword} className="space-y-4">
                    <label className="block text-xs font-bold text-slate-700">Verification Token
                      <span className="relative mt-1.5 block">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          type="text"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Paste the reset token"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-mono outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                        />
                      </span>
                    </label>

                    <label className="block text-xs font-bold text-slate-700">New Password
                      <span className="relative mt-1.5 block">
                        <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          minLength={4}
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 4 characters"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                        />
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {forgotLoading ? 'Updating password...' : 'Set New Password & Return to Login'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* Normal Login / Register Flow */
              <div className="space-y-6">

                {/* Primary Dual Switcher: Main Branch vs Authority Desk */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Select Access Portal</p>
                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setAccountType('main')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all cursor-pointer ${
                        accountType === 'main'
                          ? 'bg-white text-[#0b4b61] font-black shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-blue-600" /> Main Branch
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Command Center</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccountType('department')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all cursor-pointer ${
                        accountType === 'department'
                          ? 'bg-white text-[#0b4b61] font-black shadow-sm border border-slate-200/80'
                          : 'text-slate-600 hover:text-slate-900 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Building2 className="w-4 h-4 text-indigo-600" /> Authority Desk
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Municipal Divisions</span>
                    </button>
                  </div>
                </div>

                {/* Mode Headings */}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {accountType === 'main' 
                      ? 'Main Branch Login' 
                      : (deptMode === 'login' ? 'Department Authority Login' : 'Register Department Access')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {accountType === 'main'
                      ? 'Executive transit command, fleet optical feed, and authority access administration.'
                      : (deptMode === 'login' 
                          ? 'Access your municipal department problems, field crew mobilization, and solve workflow.' 
                          : 'Submit a new authority access request to Main Branch for verification.')}
                  </p>
                </div>

                {/* Department sub-tab switcher if in Department mode */}
                {accountType === 'department' && (
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setDeptMode('login')}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                        deptMode === 'login' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Authority Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeptMode('register')}
                      className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                        deptMode === 'register' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Request New Access
                    </button>
                  </div>
                )}

                {/* Quick 1-Click Fill Shortcuts */}
                {accountType === 'main' ? (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Main Branch Credentials:
                      </span>
                      <button
                        type="button"
                        onClick={handleQuickFillMain}
                        className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
                      >
                        1-Click Auto Fill
                      </button>
                    </div>
                    <p className="text-[11px] text-blue-800 font-mono">
                      Email: <strong>iamgokulvanan@gmail.com</strong> · Pass: <strong>gokul123@</strong>
                    </p>
                  </div>
                ) : deptMode === 'login' ? (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> 1-Click Authority Desk Demos:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickFillDept('Roads & Infrastructure', 'roads@urbannex.ai', 'roads123@')}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        🛣️ Roads Desk
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFillDept('Water & Drainage', 'water@urbannex.ai', 'water123@')}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        💧 Drainage Desk
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFillDept('Traffic Management', 'traffic@urbannex.ai', 'traffic123@')}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        🚦 Traffic Desk
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFillDept('Public Safety', 'safety@urbannex.ai', 'safety123@')}
                        className="px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        🛡️ Safety Desk
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Main Auth Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name field if registering */}
                  {accountType === 'department' && deptMode === 'register' && (
                    <label className="block text-xs font-bold text-slate-700">Official Full Name
                      <span className="relative mt-1.5 block">
                        <UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Eng. K. Rajesh"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                        />
                      </span>
                    </label>
                  )}

                  {/* Department selection for department mode */}
                  {accountType === 'department' && (
                    <label className="block text-xs font-bold text-slate-700">Authority Department
                      <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value as Department)}
                        className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50 py-3 px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {/* Work Email */}
                  <label className="block text-xs font-bold text-slate-700">
                    {accountType === 'main' ? 'Main Branch Email' : 'Authority Work Email'}
                    <span className="relative mt-1.5 block">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={accountType === 'main' ? 'iamgokulvanan@gmail.com' : 'authority@urbannex.ai'}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                      />
                    </span>
                  </label>

                  {/* Password */}
                  <label className="block text-xs font-bold text-slate-700">Password
                    <span className="relative mt-1.5 block">
                      <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        required
                        minLength={4}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm font-normal outline-none focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-600/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>

                  {/* Forgot Password Link */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-slate-400">
                      {accountType === 'main' ? 'Executive authentication' : 'Authority desk verification'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setForgotEmail(email);
                        setForgotStep(1);
                      }}
                      className="text-cyan-700 hover:text-cyan-900 font-bold hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {errorMessage && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 font-medium">
                      {errorMessage}
                    </p>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4b61] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#0b4b61]/20 transition hover:bg-[#07394a] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting 
                      ? 'Authenticating credentials...' 
                      : accountType === 'main'
                        ? 'Enter Main Command Center'
                        : (deptMode === 'login' ? `Access ${selectedDepartment} Desk` : 'Submit Access Request')}
                    {!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                  </button>
                </form>

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 
                  {accountType === 'main' 
                    ? 'Main Branch: Full City Surveillance & Authority Controls' 
                    : `Scoped to ${selectedDepartment} Problems & Solve Process`}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};