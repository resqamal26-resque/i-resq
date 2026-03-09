
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UserCircle, 
  ShieldCheck, 
  ChevronDown, 
  ArrowRight,
  ShieldAlert,
  Users,
  ShieldAlert as ShieldAlertIcon,
  Crown,
  Wifi,
  WifiOff,
  Loader2,
  Globe,
  Fingerprint,
  Zap,
  MapPin,
  UserPlus,
  CheckCircle2,
  Bell,
  Settings,
  Database,
  Save,
  X
} from 'lucide-react';
import { db } from '../services/databaseService';
import { googleSheetService } from '../services/googleSheetService';
import { supabaseService } from '../services/supabaseService';
import { User, UserRole, DatabaseConfig } from '../types';
import { MALAYSIAN_STATES } from '../constants';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [id, setId] = useState('');
  const [credential, setCredential] = useState(''); 
  const [selectedState, setSelectedState] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(UserRole.RESPONDER);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [autofillDetected, setAutofillDetected] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' } | null>(null);
  
  // ID Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Connection Test States
  const [connStatus, setConnStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  // Database Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(db.getConfig());
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const navigate = useNavigate();

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    handleCheckConnection();
    
    // Check for logout success
    if (localStorage.getItem('resq_logout_success') === 'true') {
      showToast("Log Keluar Berjaya! Sesi Ditamatkan.", "success");
      localStorage.removeItem('resq_logout_success');
    }
    
    // AUTOFILL DETECTION: Check if a user just registered
    const lastId = localStorage.getItem('resq_last_registered_id');
    const lastRole = localStorage.getItem('resq_last_registered_role') as UserRole;
    
    if (lastId && lastRole) {
      setId(lastId);
      setSelectedRole(lastRole);
      setAutofillDetected(true);
      
      // Clear the storage so it doesn't happen every visit
      localStorage.removeItem('resq_last_registered_id');
      localStorage.removeItem('resq_last_registered_role');
      localStorage.removeItem('resq_last_registered_name');
    } else {
      // Default to Responder for easier access if no autofill
      if (!selectedRole) setSelectedRole(UserRole.RESPONDER);
    }
  }, []);

  const handleCheckConnection = async () => {
    setConnStatus('checking');
    try {
      const config = db.getConfig();
      let result;
      if (config.provider === 'supabase') {
        result = await supabaseService.testConnection();
      } else {
        result = await googleSheetService.testConnection();
      }
      setConnStatus(result.status === 'success' ? 'online' : 'offline');
    } catch {
      setConnStatus('offline');
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      db.updateConfig(dbConfig);
      showToast("Konfigurasi Pangkalan Data Dikemaskini!", "success");
      setIsSettingsOpen(false);
      handleCheckConnection();
    } catch (err) {
      setError("Gagal menyimpan konfigurasi.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSimulation = async (state: string) => {
    setIsSeeding(true);
    try {
      await db.seedDemoData(state);
      alert(`Simulasi ${state} Diaktifkan! Program 'resQ ${state}' kini sedia untuk Check-in.`);
      // Refresh connection status
      handleCheckConnection();
    } catch (err) {
      alert("Gagal mengaktifkan simulasi.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDemoSuperAdminLogin = async () => {
    setIsVerifying(true);
    try {
      await db.seedDemoData(); // Ensure users exist
      const localUsers = await db.getUsers();
      const saUser = localUsers.find(u => u.id === 'SA_GLOBAL_001');
      if (saUser) {
        onLogin(saUser);
        navigate('/');
      }
    } catch (err) {
      setError('Gagal log masuk demo.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      if (selectedRole === UserRole.RESPONDER) {
        // RESPONDER AUTO-LOGIN FLOW
        if (!id.trim() || !selectedState) {
          setError('Sila masukkan Nama Penuh dan pilih Negeri.');
          setIsVerifying(false);
          return;
        }

        const stateObj = MALAYSIAN_STATES.find(s => s.name === selectedState);
        const abbr = stateObj?.abbr || 'MY';
        const localUsers = await db.getUsers();
        
        // Find existing or create new
        let currentUser = localUsers.find(u => 
          u.name.toLowerCase() === id.trim().toLowerCase() && 
          u.state === selectedState &&
          u.role === UserRole.RESPONDER
        );

        if (!currentUser) {
          // Auto-create ID for new responder
          const autoId = `RES_${abbr}_${Date.now().toString().slice(-4)}`;
          currentUser = {
            id: autoId,
            name: id.trim(),
            role: UserRole.RESPONDER,
            state: selectedState,
            createdAt: new Date().toISOString()
          };
          await db.addUser(currentUser);
          // Try to sync to cloud (optional, non-blocking)
          googleSheetService.registerUser(currentUser).catch(() => {});
        }

        onLogin(currentUser);
        navigate('/checkin');
      } else {
        // ADMIN LOGIN FLOW (MECC, SUPERADMIN, etc.)
        const cleanId = id.trim().toUpperCase();
        const localUsers = await db.getUsers();
        let currentUser = localUsers.find(u => u.id === cleanId);

        // If not local, check cloud
        if (!currentUser) {
          const cloudResult = await googleSheetService.checkUserById(cleanId);
          if (cloudResult.status === 'success' && cloudResult.user) {
            currentUser = cloudResult.user as User;
            await db.addUser(currentUser);
          }
        }

        if (!currentUser || currentUser.password !== credential) {
          setError('ID Petugas atau Kata Laluan tidak sah.');
          setIsVerifying(false);
          return;
        }

        if (currentUser.role !== selectedRole) {
          setError(`ID ini berdaftar sebagai ${currentUser.role}. Sila tukar kategori.`);
          setIsVerifying(false);
          return;
        }

        onLogin(currentUser);
        navigate('/');
      }
    } catch (err) {
      setError('Ralat sistem semasa log masuk. Sila cuba lagi.');
    } finally {
      setIsVerifying(false);
    }
  };

  const roles = [
    { value: UserRole.RESPONDER, label: 'Responder', icon: <UserCircle className="w-5 h-5" /> },
    { value: UserRole.MECC, label: 'MECC Admin', icon: <ShieldCheck className="w-5 h-5" /> },
    { value: UserRole.MECC_HQ, label: 'MECC HQ', icon: <Globe className="w-5 h-5" /> },
    { value: UserRole.AJK, label: 'AJK Program', icon: <Users className="w-5 h-5" /> },
    { value: UserRole.PIC, label: 'PIC Checkpoint', icon: <ShieldAlertIcon className="w-5 h-5" /> },
    { value: UserRole.SUPERADMIN, label: 'Super Admin', icon: <Crown className="w-5 h-5" /> },
  ];

  const currentRoleObj = roles.find(r => r.value === selectedRole);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-inter">
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-10 fade-in duration-300 w-[90%] max-w-sm text-center">
          <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border ${toast.type === 'success' ? 'bg-green-600 border-green-500' : 'bg-slate-800 border-slate-700'} text-white`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            <p className="font-bold text-xs">{toast.message}</p>
          </div>
        </div>
      )}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[100px]"></div>
      
      {/* Admin Settings Trigger */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all z-50 group"
        title="Admin Database Setup"
      >
        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <div className="max-w-md w-full flex flex-col gap-4 relative z-10">
        {/* Simulation Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleSimulation('Selangor')}
            disabled={isSeeding}
            className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 py-3.5 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all group backdrop-blur-sm"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-400" />}
            <span className="text-[8px] font-black uppercase tracking-[0.2em]">🚀 Simulasi Selangor</span>
          </button>
          <button 
            onClick={() => handleSimulation('Pahang')}
            disabled={isSeeding}
            className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 py-3.5 rounded-3xl flex flex-col items-center justify-center gap-1 transition-all group backdrop-blur-sm"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-red-400" />}
            <span className="text-[8px] font-black uppercase tracking-[0.2em]">🚀 Simulasi Pahang</span>
          </button>
        </div>

        <button 
          onClick={handleDemoSuperAdminLogin}
          disabled={isVerifying}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-white/10 text-white py-4 rounded-3xl flex items-center justify-center gap-3 transition-all group shadow-2xl"
        >
          {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-5 h-5 text-amber-400" />}
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Demo SuperAdmin Access</span>
        </button>

        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700 border border-white/5">
          <div className={`py-12 px-8 text-center relative overflow-hidden transition-all duration-500 ${selectedRole === UserRole.SUPERADMIN ? 'bg-slate-950' : 'bg-red-600'}`}>
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-1 relative z-10 italic">resQ Amal</h1>
            <p className="text-red-100 font-bold text-[9px] uppercase tracking-[0.4em] opacity-90 relative z-10">Tactical Emergency Protocol</p>
          </div>

          <div className="p-8 md:p-10">
            <div className="w-full space-y-6 animate-in fade-in duration-500">
              
              {autofillDetected && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-500">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">ID Pendaftaran Dikesan & Diisi</p>
                </div>
              )}

              {/* Role Selector */}
              <div className="relative w-full text-center">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center justify-between p-5 bg-slate-50 border rounded-2xl transition-all duration-300 ${
                    isDropdownOpen ? 'ring-4 ring-red-500/10 border-red-500 bg-white shadow-xl' : 'border-slate-100'
                  } ${autofillDetected ? 'ring-4 ring-emerald-500/10 border-emerald-500' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl transition-all ${selectedRole ? (selectedRole === UserRole.SUPERADMIN ? 'bg-slate-900' : 'bg-red-600') + ' text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {currentRoleObj ? currentRoleObj.icon : <Fingerprint className="w-5 h-5" />}
                    </div>
                    <p className={`font-black text-xs uppercase tracking-tight ${selectedRole ? 'text-slate-800' : 'text-slate-500'}`}>
                      {selectedRole ? currentRoleObj?.label : 'Kategori Petugas'}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-[110%] left-0 right-0 bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => {
                          setSelectedRole(role.value);
                          setIsDropdownOpen(false);
                          setError('');
                          setAutofillDetected(false);
                        }}
                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0"
                      >
                        <div className={`p-2.5 rounded-xl ${selectedRole === role.value ? (role.value === UserRole.SUPERADMIN ? 'bg-slate-900' : 'bg-red-600') + ' text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {role.icon}
                        </div>
                        <p className={`font-black text-xs ${selectedRole === role.value ? 'text-slate-900' : 'text-slate-600'}`}>{role.label}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Dynamic Inputs based on Role */}
                {selectedRole === UserRole.RESPONDER ? (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nama Penuh</label>
                      <input
                        type="text"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        className="w-full px-6 py-5 bg-white border border-slate-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none font-black text-slate-800 text-sm"
                        placeholder="Cth: AHMAD BIN ABU"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Negeri Bertugas</label>
                      <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none font-black text-slate-800 text-sm appearance-none"
                        required
                      >
                        <option value="">-- PILIH NEGERI --</option>
                        {MALAYSIAN_STATES.map(s => <option key={s.abbr} value={s.name}>{s.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">ID Petugas</label>
                       <input
                        type="text"
                        value={id}
                        onChange={(e) => { setId(e.target.value.toUpperCase()); setAutofillDetected(false); }}
                        className={`w-full px-6 py-5 bg-white border rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none font-black text-slate-800 text-sm tracking-tight transition-all ${autofillDetected ? 'border-emerald-500 bg-emerald-50/10 ring-4 ring-emerald-500/5' : 'border-slate-100'}`}
                        placeholder="ID PETUGAS (MECC/AJK/PIC)"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Kata Laluan</label>
                      <input
                        type="password"
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none font-black text-slate-800 text-sm"
                        placeholder="KATA LALUAN SISTEM"
                        required
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="text-red-600 text-[10px] font-black bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 shrink-0" /> <p className="leading-tight">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  className={`w-full text-white font-black py-6 rounded-[2rem] shadow-2xl transform transition-all active:scale-95 flex items-center justify-center gap-4 text-xl ${
                    selectedRole === UserRole.SUPERADMIN ? 'bg-slate-900' : 'bg-red-600 shadow-red-200'
                  }`}
                >
                  {isVerifying ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                  {selectedRole === UserRole.RESPONDER ? 'Log Masuk Tugas' : 'Masuk Sistem'}
                </button>
              </form>

              {/* Bottom Action Area */}
              <div className="pt-4 text-center border-t border-slate-100">
                {selectedRole === UserRole.RESPONDER ? (
                  <div className="space-y-4">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed px-4">
                       ID Responder akan dijana secara automatik berdasarkan nama dan negeri anda.
                     </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Admin Baru?</p>
                    <Link 
                      to="/register" 
                      className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-red-600 transition-all border border-slate-100 shadow-sm"
                    >
                      <UserPlus className="w-4 h-4" /> Daftar Admin MECC
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Connectivity Status Overlay */}
        <div className="flex justify-center gap-4">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${connStatus === 'online' ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-slate-500'}`}>
              {connStatus === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connStatus === 'online' ? (db.getConfig().provider === 'supabase' ? 'Supabase Cloud Online' : 'Master HQ Online') : 'Cloud Sync Pending'}
           </div>
        </div>
      </div>

      {/* Database Setup Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Database Setup</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Admin Configuration Only</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Provider Utama</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDbConfig({ ...dbConfig, provider: 'googlesheet' })}
                    className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      dbConfig.provider === 'googlesheet' 
                        ? 'border-red-600 bg-red-50 text-red-600' 
                        : 'border-slate-100 bg-slate-50 text-slate-400 grayscale'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Google Sheet</span>
                  </button>
                  <button
                    onClick={() => setDbConfig({ ...dbConfig, provider: 'supabase' })}
                    className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
                      dbConfig.provider === 'supabase' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-100 bg-slate-50 text-slate-400 grayscale'
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Supabase</span>
                  </button>
                </div>
              </div>

              {dbConfig.provider === 'googlesheet' ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google App Script URL</label>
                  <textarea
                    value={dbConfig.googlesheetUrl || ''}
                    onChange={(e) => setDbConfig({ ...dbConfig, googlesheetUrl: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none font-bold text-slate-800 text-xs h-24 resize-none"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supabase Project URL</label>
                    <input
                      type="text"
                      value={dbConfig.supabaseUrl || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, supabaseUrl: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-800 text-xs"
                      placeholder="https://xyz.supabase.co"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supabase Anon Key</label>
                    <input
                      type="password"
                      value={dbConfig.supabaseKey || ''}
                      onChange={(e) => setDbConfig({ ...dbConfig, supabaseKey: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-800 text-xs"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    />
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95"
                >
                  {isSavingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  SIMPAN KONFIGURASI
                </button>
                <p className="text-center mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Perubahan akan memberi kesan kepada penyelarasan awan secara langsung.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
