
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Attendance, Case, Notification, UserRole, Program } from '../../types';
import { 
  Activity, 
  FilePlus, 
  Hospital, 
  LogOut, 
  CheckCircle, 
  Bell, 
  Wifi, 
  WifiOff, 
  Loader2, 
  Navigation, 
  User as UserIcon,
  Save,
  MapPin,
  Briefcase,
  Zap,
  ArrowLeftCircle,
  Contact,
  Phone,
  MessageCircle,
  Search,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Truck,
  X,
  MessageSquare,
  Send,
  Edit3,
  Power,
  Clock,
  ClipboardList,
  AlertTriangle,
  BookOpen,
  Info,
  Layers,
  Thermometer,
  Droplets,
  HeartPulse,
  Scale,
  CalendarDays
} from 'lucide-react';
import CaseReportForm from './CaseReportForm';
import CaseList from './CaseList';
import NearbyReferrals from './NearbyReferrals';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { MALAYSIAN_STATES } from '../../constants';

interface ResponderLayoutProps {
  user: User;
  onLogout: () => void;
  activeTask: Attendance;
}

const ResponderLayout: React.FC<ResponderLayoutProps> = ({ user, onLogout, activeTask }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cases, setCases] = useState<Case[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [meccAdmin, setMeccAdmin] = useState<User | null>(null);
  const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' } | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [showEndDutyModal, setShowEndDutyModal] = useState(false);
  const [showFinalReport, setShowFinalReport] = useState(false);
  const [finalExitTime, setFinalExitTime] = useState('');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideTab, setGuideTab] = useState<'vitals' | 'gcs' | 'bmi' | 'dxt'>('vitals');
  const [isEndingDuty, setIsEndingDuty] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Quick Message Selection State
  const [selectedContactForMessage, setSelectedContactForMessage] = useState<{name: string, phone: string} | null>(null);

  // Profile Edit State
  const [profileName, setProfileName] = useState(user.name);
  const [profileState, setProfileState] = useState(user.state);
  const [profileAssignment, setProfileAssignment] = useState(user.assignment || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const checkConnectivity = useCallback(async () => {
    try {
      const result = await googleSheetService.testConnection();
      setConnStatus(result.status === 'success' ? 'online' : 'offline');
    } catch {
      setConnStatus('offline');
    }
  }, []);

  const fetchData = useCallback(async () => {
    const allCases = await db.getCases(activeTask.programId);
    const sessionCases = allCases.filter(c => c.responderName === user.name && c.programId === activeTask.programId);
    setCases(sessionCases);

    const allAttendance = await db.getAttendance();
    const userAttendance = allAttendance.filter(a => a.responderName === user.name).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setAttendanceHistory(userAttendance);

    const programs = await db.getPrograms();
    const prog = programs.find(p => p.id === activeTask.programId);
    setActiveProgram(prog || null);

    const users = await db.getUsers(user.state);
    const admin = users.find(u => u.role === UserRole.MECC);
    setMeccAdmin(admin || null);
  }, [activeTask.programId, user.name, user.state]);

  useEffect(() => {
    checkConnectivity();
    fetchData();

    const interval = setInterval(() => {
      checkConnectivity();
      fetchData();
      setCurrentTime(new Date());
    }, 1000); // 1s to keep clock updated

    return () => clearInterval(interval);
  }, [checkConnectivity, fetchData]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    const updatedUser: User = { ...user, name: profileName, state: profileState, assignment: profileAssignment };
    try {
      await db.updateUser(updatedUser);
      await googleSheetService.registerUser(updatedUser);
      showToast("Profil berjaya dikemaskini!", "success");
    } catch (err) {
      showToast("Gagal menyelaraskan profil ke cloud.", "info");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const calculateDuration = useMemo(() => {
    try {
      // Parse DD/MM/YYYY HH:MM AM/PM
      const parts = activeTask.entryTime.split(' ');
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      let hours = parseInt(timeParts[0]);
      if (parts[2] === 'PM' && hours < 12) hours += 12;
      if (parts[2] === 'AM' && hours === 12) hours = 0;
      
      const start = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), hours, parseInt(timeParts[1]));
      const now = currentTime;
      const diffMs = now.getTime() - start.getTime();
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      return `${diffHrs}j ${diffMins}m`;
    } catch (e) {
      return 'N/A';
    }
  }, [activeTask.entryTime, currentTime]);

  const currentFormattedTime = useMemo(() => {
    let hours = currentTime.getHours();
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }, [currentTime]);

  const confirmEndDuty = async () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    
    setFinalExitTime(`${dateStr} ${timeStr}`);
    setShowEndDutyModal(false);
    setShowFinalReport(true);
  };

  const shareTaskReportToWhatsApp = () => {
    const message = `*LAPORAN TAMAT TUGAS resQ AMAL*
--------------------------------
*Program:* ${activeTask.programName || 'Program Am'}
*Tarikh:* ${activeTask.programDate || '-'}
*Checkpoint:* ${activeTask.checkpoint}
*Petugas:* ${user.name}
--------------------------------
*Masa Masuk:* ${activeTask.entryTime}
*Masa Keluar:* ${finalExitTime}
*Bil. Kes Dilapor:* ${cases.length === 0 ? 'TIADA KES DILAPORKAN' : `${cases.length} Kes`}
--------------------------------
_Dihantar melalui Sistem resQ Amal_`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleFinalLogout = () => {
    onLogout();
  };

  const handleQuickMessageSend = async (message: string, internal = false) => {
    if (!selectedContactForMessage) return;
    
    if (internal) {
      try {
        const notification: Notification = {
          id: `NOTIF_${Date.now()}`,
          programId: activeTask.programId,
          senderName: user.name,
          message: `MESEJ KECEMASAN: ${message || 'Sila hubungi saya segera!'}`,
          timestamp: new Date().toISOString(),
          type: 'message'
        };
        await db.addNotification(notification);
        showToast("Mesej Kecemasan dihantar ke MECC!", "success");
      } catch (err) {
        showToast("Gagal menghantar mesej dalaman.", "info");
      }
    } else {
      const url = `https://wa.me/${selectedContactForMessage.phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
    setSelectedContactForMessage(null);
  };

  const isSimulation = activeTask.programId === 'PHG_PROG_001' || activeTask.programId === '260501';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 relative font-inter">
      {isSimulation && (
        <div className="bg-amber-500 text-white px-6 py-2 flex justify-between items-center shadow-lg relative z-[60] animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest">Mod Simulasi Aktif</span>
          </div>
          <button onClick={() => setShowEndDutyModal(true)} className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
            <Power className="w-3 h-3" /> Tamat Tugas
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10 fade-in duration-300 w-[90%] max-w-sm text-center">
          <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 border ${toast.type === 'success' ? 'bg-green-600 border-green-500' : 'bg-slate-800 border-slate-700'} text-white`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            <p className="font-bold text-xs">{toast.message}</p>
          </div>
        </div>
      )}

      <header className="bg-red-600 text-white sticky top-0 z-40 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="font-black text-lg tracking-tighter uppercase italic leading-none mb-0.5">resQ Field</h1>
            <p className="text-[9px] font-black opacity-80 uppercase tracking-widest">
              {activeTask.checkpoint} {activeTask.area ? `• ${activeTask.area}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl border border-emerald-400/30 transition-all group shadow-lg active:scale-95"
            >
              <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-widest hidden xs:inline">Vitals</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button onClick={() => setShowEndDutyModal(true)} className="p-2.5 bg-red-800/60 hover:bg-red-900 rounded-xl transition-all shadow-inner group">
              <Power className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full p-4 flex-1">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                <p className="text-4xl font-black text-slate-900">{cases.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Kes Sesi Ini</p>
              </div>
              <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
                <p className="text-sm font-black text-indigo-900 truncate mb-1">{user.name}</p>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                  {activeTask.area || 'KAWASAN AM'} • {activeTask.task || 'TUGASAN AM'}
                </p>
              </div>
            </div>

            {/* Quick Access Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setActiveTab('report')}
                className="bg-red-600 text-white p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
              >
                <div className="p-3 bg-white/20 rounded-2xl">
                  <FilePlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Laporan Pantas</span>
              </button>
              <button 
                onClick={() => setShowDirectoryModal(true)}
                className="bg-slate-900 text-white p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
              >
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Contact className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Direktori</span>
              </button>
            </div>

            <CaseList cases={cases} onCaseUpdate={fetchData} />

            {/* End Duty Shortcut Card */}
            <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 flex flex-col items-center text-center space-y-4">
               <div className="p-4 bg-red-100 text-red-600 rounded-full"><Power className="w-8 h-8" /></div>
               <div>
                  <h3 className="text-lg font-black text-red-900 uppercase tracking-tight">Tamat Tugas Lapangan</h3>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Sahkan semua maklumat sebelum log keluar</p>
               </div>
               <button 
                onClick={() => setShowEndDutyModal(true)}
                className="w-full py-4 bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all"
               >
                 Log Tamat Tugas
               </button>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="animate-in slide-in-from-bottom-6 duration-500">
            <CaseReportForm user={user} activeTask={activeTask} onCaseAdded={fetchData} showToast={showToast} />
          </div>
        )}

        {activeTab === 'referral' && (
          <div className="animate-in fade-in duration-500">
            <NearbyReferrals />
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-red-600" /> Sejarah Kehadiran
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Rekod Laporan Kehadiran Anda</p>
            </div>

            <div className="space-y-4">
              {attendanceHistory.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100">
                  <AlertTriangle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Tiada rekod kehadiran ditemui</p>
                </div>
              ) : (
                attendanceHistory.map(a => (
                  <div key={a.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{a.programName || 'Program Am'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{a.checkpoint} • {a.area || 'KAWASAN AM'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                        a.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 
                        a.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {a.status || 'Pending'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Masa Masuk</p>
                        <p className="text-[10px] font-bold text-slate-700">{a.entryTime}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dijangka Keluar</p>
                        <p className="text-[10px] font-bold text-slate-700">{a.expectedExitTime || '-'}</p>
                      </div>
                    </div>
                    {a.remark && (
                      <div className="bg-slate-50 p-3 rounded-xl">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Catatan / Remark</p>
                        <p className="text-[10px] font-bold text-slate-600 italic leading-tight">{a.remark}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center py-6">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl"><UserIcon className="w-12 h-12" /></div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Profil Petugas</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {user.id}</p>
            </div>
            <form onSubmit={handleUpdateProfile} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Nama Penuh</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none focus:ring-4 focus:ring-red-500/10" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><MapPin className="w-3 h-3" /> Kawasan (Negeri)</label>
                <select value={profileState} onChange={(e) => setProfileState(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none" required>
                  {MALAYSIAN_STATES.map(s => <option key={s.abbr} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Briefcase className="w-3 h-3" /> Tugasan / Peranan Khusus</label>
                <input type="text" value={profileAssignment} onChange={(e) => setProfileAssignment(e.target.value)} placeholder="Cth: Medic Leader, Dispatcher" className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-sm outline-none" />
              </div>
              <button type="submit" disabled={isUpdatingProfile} className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-all">
                {isUpdatingProfile ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Kemaskini Profil
              </button>
            </form>
          </div>
        )}
      </main>

      {/* COMPREHENSIVE CLINICAL GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowGuideModal(false)}></div>
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-emerald-100">
              <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/20 rounded-2xl shadow-inner"><Activity className="w-8 h-8" /></div>
                    <div>
                       <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Panduan <br/> <span className="text-emerald-200">Tanda Vital</span></h3>
                       <p className="text-[9px] font-black text-emerald-100 uppercase tracking-widest mt-2">Clinical Reference v2.4</p>
                    </div>
                 </div>
                 <button onClick={() => setShowGuideModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-7 h-7" /></button>
              </div>

              {/* Guide Tabs */}
              <div className="flex bg-emerald-50 p-2 gap-1 overflow-x-auto custom-scrollbar shrink-0">
                 {[
                   { id: 'vitals', label: 'Vitals', icon: <HeartPulse className="w-4 h-4" /> },
                   { id: 'gcs', label: 'GCS', icon: <Layers className="w-4 h-4" /> },
                   { id: 'dxt', label: 'DXT', icon: <Droplets className="w-4 h-4" /> },
                   { id: 'bmi', label: 'BMI', icon: <Scale className="w-4 h-4" /> }
                 ].map(tab => (
                   <button 
                    key={tab.id}
                    onClick={() => setGuideTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      guideTab === tab.id ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100' : 'text-emerald-600/60 hover:bg-white/50'
                    }`}
                   >
                     {tab.icon} {tab.label}
                   </button>
                 ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white custom-scrollbar">
                {guideTab === 'vitals' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-3 h-3 text-emerald-500" /> Julat Normal Mengikut Umur</h4>
                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 border-b">
                                 <tr className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
                                    <th className="px-4 py-3">Umur</th>
                                    <th className="px-4 py-3">PR (bpm)</th>
                                    <th className="px-4 py-3">BP (Systolic)</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y text-[10px] font-bold text-slate-700">
                                 <tr><td className="px-4 py-3 bg-slate-50/30">Neonate (&lt;28d)</td><td className="px-4 py-3">100 - 180</td><td className="px-4 py-3">60 - 90</td></tr>
                                 <tr><td className="px-4 py-3 bg-slate-50/30">Infant (1-12m)</td><td className="px-4 py-3">100 - 160</td><td className="px-4 py-3">70 - 100</td></tr>
                                 <tr><td className="px-4 py-3 bg-slate-50/30">Child (1-12y)</td><td className="px-4 py-3">70 - 120</td><td className="px-4 py-3">80 - 110</td></tr>
                                 <tr><td className="px-4 py-3 bg-slate-50/30">Adult (&gt;18y)</td><td className="px-4 py-3">60 - 100</td><td className="px-4 py-3">100 - 140</td></tr>
                              </tbody>
                           </table>
                        </div>
                     </div>
                     <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <Layers className="w-3 h-3" /> Status Oksigen (SpO2)
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                           <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-green-200">
                              <span className="text-[10px] font-bold text-green-700">Normal (Ambient Air)</span>
                              <span className="font-black text-xs">&gt; 95%</span>
                           </div>
                           <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                              <span className="text-[10px] font-bold text-amber-700">Caution / Amaran</span>
                              <span className="font-black text-xs">90% - 94%</span>
                           </div>
                           <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-red-200">
                              <span className="text-[10px] font-bold text-red-700">Kecemasan (Hypoxia)</span>
                              <span className="font-black text-xs">&lt; 90%</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {guideTab === 'gcs' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-emerald-400">Glasgow Coma Scale (Adult)</h4>
                        <div className="space-y-4">
                           <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Eyes (1-4)</p>
                              <div className="text-[10px] space-y-1 pl-2 border-l border-white/10 font-bold opacity-80">
                                 <p>4: Spontan</p>
                                 <p>3: Kepada Suara</p>
                                 <p>2: Kepada Sakit</p>
                                 <p>1: Tiada Respon</p>
                              </div>
                           </div>
                           <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Verbal (1-5)</p>
                              <div className="text-[10px] space-y-1 pl-2 border-l border-white/10 font-bold opacity-80">
                                 <p>5: Berorientasi</p>
                                 <p>4: Keliru (Confused)</p>
                                 <p>3: Perkataan tidak sesuai</p>
                                 <p>2: Bunyi tidak difahami</p>
                                 <p>1: Tiada Respon</p>
                              </div>
                           </div>
                           <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Motor (1-6)</p>
                              <div className="text-[10px] space-y-1 pl-2 border-l border-white/10 font-bold opacity-80">
                                 <p>6: Mengikut arahan</p>
                                 <p>5: Melokalisasi sakit</p>
                                 <p>4: Menarik diri (Withdraws)</p>
                                 <p>3: Flexion abnormal (Decorticate)</p>
                                 <p>2: Extension abnormal (Decebrate)</p>
                                 <p>1: Tiada Respon</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {guideTab === 'dxt' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-indigo-700 flex items-center gap-2"><Droplets className="w-4 h-4" /> Tahap Gula (mmol/L)</h4>
                        <div className="space-y-3">
                           <div className="flex items-center justify-between p-3 bg-white rounded-2xl">
                              <span className="text-[10px] font-bold text-slate-600">Berpuasa (Fasting)</span>
                              <span className="font-black text-xs text-indigo-600">4.0 - 5.4</span>
                           </div>
                           <div className="flex items-center justify-between p-3 bg-white rounded-2xl">
                              <span className="text-[10px] font-bold text-slate-600">2 Jam Selepas Makan</span>
                              <span className="font-black text-xs text-indigo-600">&lt; 7.8</span>
                           </div>
                           <div className="flex items-center justify-between p-3 bg-white rounded-2xl border-2 border-red-100">
                              <span className="text-[10px] font-bold text-red-600">Hipoglisemia (Emergency)</span>
                              <span className="font-black text-xs text-red-600">&lt; 3.9</span>
                           </div>
                           <div className="flex items-center justify-between p-3 bg-white rounded-2xl border-2 border-orange-100">
                              <span className="text-[10px] font-bold text-orange-600">Hiperglisemia (Kritikal)</span>
                              <span className="font-black text-xs text-orange-600">&gt; 11.0</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {guideTab === 'bmi' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                     <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-slate-700 flex items-center gap-2"><Scale className="w-4 h-4" /> Klasifikasi BMI (Dewasa)</h4>
                        <div className="space-y-2">
                           {[
                             { range: '< 18.5', label: 'Underweight', color: 'bg-blue-100 text-blue-700' },
                             { range: '18.5 - 24.9', label: 'Normal Weight', color: 'bg-green-100 text-green-700' },
                             { range: '25.0 - 29.9', label: 'Overweight', color: 'bg-amber-100 text-amber-700' },
                             { range: '30.0 - 34.9', label: 'Obese (Class I)', color: 'bg-orange-100 text-orange-700' },
                             { range: '> 35.0', label: 'Severely Obese', color: 'bg-red-100 text-red-700' }
                           ].map((item, i) => (
                             <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${item.color}`}>{item.label}</span>
                                <span className="font-mono font-black text-xs text-slate-400">{item.range}</span>
                             </div>
                           ))}
                        </div>
                        <div className="mt-6 p-4 bg-slate-100 rounded-2xl text-center">
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Formula: Berat (kg) / [Tinggi (m) x Tinggi (m)]</p>
                        </div>
                     </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
                 <button 
                  onClick={() => setShowGuideModal(false)}
                  className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-tighter rounded-[2rem] shadow-xl flex items-center justify-center gap-4 active:scale-95 transition-all"
                 >
                   <ArrowLeftCircle className="w-6 h-6" />
                   Kembali ke Dashboard
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* END DUTY CONFIRMATION MODAL */}
      {showEndDutyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowEndDutyModal(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-red-100">
             <div className="p-8 bg-red-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white/20 rounded-2xl shadow-inner"><Power className="w-7 h-7" /></div>
                   <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Log Tamat Tugas</h3>
                      <p className="text-[9px] font-black text-red-100 uppercase tracking-widest mt-1">Sahkan Rekod Penutup Sesi</p>
                   </div>
                </div>
                <button onClick={() => setShowEndDutyModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
             </div>

             <div className="p-10 space-y-8 bg-slate-50 overflow-y-auto custom-scrollbar max-h-[75vh]">
                <div className="space-y-6">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ringkasan Kehadiran & Sesi</h4>
                   
                   <div className="grid grid-cols-1 gap-4">
                      {/* Identity Card */}
                      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                         <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><UserIcon className="w-6 h-6" /></div>
                         <div className="flex-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Petugas Lapangan</p>
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{user.name}</p>
                            <p className="text-[9px] font-bold text-indigo-500 uppercase">
                              {activeTask.checkpoint} • {activeTask.area || 'KAWASAN AM'} • {activeTask.task || 'TUGASAN AM'}
                            </p>
                         </div>
                      </div>

                      {/* Time Grid */}
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:scale-110 transition-transform"><Clock className="w-12 h-12" /></div>
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Mula Tugas</p>
                            <p className="text-sm font-black text-slate-800 leading-none">{activeTask.entryTime.split(' ')[1]} {activeTask.entryTime.split(' ')[2]}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-2">{activeTask.entryTime.split(' ')[0]}</p>
                         </div>
                         <div className="bg-red-50 p-5 rounded-[2rem] border border-red-100 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:scale-110 transition-transform"><Power className="w-12 h-12" /></div>
                            <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Power className="w-3 h-3" /> Tamat Tugas</p>
                            <p className="text-sm font-black text-red-900 leading-none">{currentFormattedTime}</p>
                            <p className="text-[9px] font-bold text-red-400 mt-2">Waktu Sistem (MYT)</p>
                         </div>
                      </div>

                      {/* Performance Stats */}
                      <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl flex flex-col justify-between group">
                            <Activity className="w-5 h-5 text-indigo-400 mb-4 group-hover:rotate-12 transition-transform" />
                            <div>
                               <p className="text-2xl font-black tracking-tighter leading-none">{calculateDuration}</p>
                               <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Tempoh Bertugas</p>
                            </div>
                         </div>
                         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group">
                            <ClipboardList className="w-5 h-5 text-red-600 mb-4 group-hover:scale-110 transition-transform" />
                            <div>
                               <p className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{cases.length}</p>
                               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Laporan Kes Sesi Ini</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
                   <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                   <p className="text-[11px] font-bold text-amber-900 leading-relaxed italic">"Dengan menekan butang Sahkan & Tamat Tugas, maklumat di atas akan direkodkan secara kekal ke dalam Pangkalan Data Kehadiran HQ resQ Amal."</p>
                </div>

                <div className="space-y-4">
                   <button 
                    onClick={confirmEndDuty} 
                    className="w-full py-6 bg-red-600 text-white font-black text-xl uppercase tracking-tighter rounded-[2.5rem] shadow-2xl shadow-red-100 flex items-center justify-center gap-4 active:scale-95 transition-all group"
                   >
                     <Power className="w-7 h-7 group-hover:scale-110 transition-transform" />
                     Sahkan & Tamat Tugas
                   </button>
                   <button 
                    onClick={() => setShowEndDutyModal(false)}
                    className="w-full py-4 bg-white border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
                   >
                     Kembali ke Dashboard
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* FINAL TASK REPORT MODAL (POST-CONFIRMATION) */}
      {showFinalReport && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"></div>
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-emerald-100">
            <div className="p-10 bg-emerald-600 text-white text-center relative">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter relative z-10">Tugas Selesai!</h2>
              <p className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.3em] mt-2 relative z-10">Laporan Tugas Lapangan</p>
            </div>

            <div className="p-10 space-y-8 bg-white">
              <div className="space-y-4">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Program</p>
                    <p className="text-xs font-black text-slate-800 uppercase text-right">{activeTask.programName}</p>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Checkpoint</p>
                    <p className="text-xs font-black text-slate-800 uppercase text-right">{activeTask.checkpoint}</p>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Masa Tugas</p>
                    <p className="text-xs font-black text-slate-800 text-right">{activeTask.entryTime.split(' ')[1]} - {finalExitTime.split(' ')[1]}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kes Dilapor</p>
                    <p className={`text-lg font-black ${cases.length === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {cases.length === 0 ? 'TIADA KES DILAPORKAN' : `${cases.length} Kes`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={shareTaskReportToWhatsApp}
                  className="w-full py-6 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-xl shadow-emerald-100 flex items-center justify-center gap-4 active:scale-95 transition-all"
                >
                  <MessageCircle className="w-6 h-6" />
                  Hantar ke WhatsApp
                </button>
                
                <button 
                  onClick={handleFinalLogout}
                  disabled={isEndingDuty}
                  className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-widest rounded-[2rem] flex items-center justify-center gap-4 active:scale-95 transition-all"
                >
                  {isEndingDuty ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                  Selesai & Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TACTICAL DIRECTORY MODAL */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowDirectoryModal(false)}></div>
           <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border border-white/5">
              <div className="p-8 bg-slate-950 flex justify-between items-center shrink-0 border-b border-white/5">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 rounded-2xl shadow-lg"><Contact className="w-6 h-6 text-white" /></div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Direktori Petugas</h3>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Senarai Kontak Program Aktif</p>
                    </div>
                 </div>
                 <button onClick={() => setShowDirectoryModal(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-6 bg-slate-800 shrink-0">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={directorySearch} 
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Cari PIC / Stesen / Ambulans..." 
                      className="w-full pl-12 pr-6 py-4 bg-slate-900 border border-white/5 rounded-2xl font-bold text-white text-sm focus:ring-4 focus:ring-red-600/10 outline-none"
                    />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-950/30">
                {/* MECC Section */}
                {meccAdmin && (
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-indigo-400" /> MECC Admin ({user.state})
                    </h3>
                    <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-sm flex items-center justify-between group">
                       <div className="flex-1">
                          <p className="font-black text-white uppercase text-sm tracking-tight">{meccAdmin.name}</p>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Pusat Kawalan Perubatan</p>
                       </div>
                       <div className="flex gap-2">
                          <a href={`tel:${meccAdmin.phone}`} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"><Phone className="w-4 h-4" /></a>
                          <div className="flex flex-col gap-1">
                             <a href={`https://wa.me/${meccAdmin.phone}`} target="_blank" className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageCircle className="w-4 h-4" /></a>
                             <button onClick={() => setSelectedContactForMessage({name: meccAdmin.name, phone: meccAdmin.phone || ''})} className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><MessageSquare className="w-4 h-4" /></button>
                          </div>
                       </div>
                    </div>
                  </section>
                )}

                {/* Checkpoints Section */}
                {activeProgram?.checkpoints && (
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                       <MapPin className="w-4 h-4 text-red-500" /> PIC Checkpoint
                    </h3>
                    <div className="space-y-3">
                       {activeProgram.checkpoints
                        .filter(cp => cp.pic.toLowerCase().includes(directorySearch.toLowerCase()) || cp.callsign.toLowerCase().includes(directorySearch.toLowerCase()))
                        .map(cp => (
                         <div key={cp.id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                            <div className="flex-1">
                               <p className="font-black text-white uppercase text-sm tracking-tight">{cp.pic}</p>
                               <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">{cp.callsign}</p>
                            </div>
                            <div className="flex gap-2">
                               <a href={`tel:${cp.phone}`} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"><Phone className="w-4 h-4" /></a>
                               <div className="flex flex-col gap-1">
                                  <a href={`https://wa.me/${cp.phone}`} target="_blank" className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageCircle className="w-4 h-4" /></a>
                                  <button onClick={() => setSelectedContactForMessage({name: cp.pic, phone: cp.phone || ''})} className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><MessageSquare className="w-4 h-4" /></button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  </section>
                )}

                {/* Ambulances Section */}
                {activeProgram?.ambulances && (
                  <section className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                       <Truck className="w-4 h-4 text-amber-500" /> Krew Ambulans
                    </h3>
                    <div className="space-y-3">
                       {activeProgram.ambulances
                        .filter(amb => amb.pic.toLowerCase().includes(directorySearch.toLowerCase()) || amb.callsign.toLowerCase().includes(directorySearch.toLowerCase()))
                        .map(amb => (
                         <div key={amb.id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                            <div className="flex-1">
                               <p className="font-black text-white uppercase text-sm tracking-tight">{amb.pic}</p>
                               <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{amb.callsign} ({amb.noPlate})</p>
                            </div>
                            <div className="flex gap-2">
                               <a href={`tel:${amb.phone}`} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"><Phone className="w-4 h-4" /></a>
                               <div className="flex flex-col gap-1">
                                  <a href={`https://wa.me/${amb.phone}`} target="_blank" className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageCircle className="w-4 h-4" /></a>
                                  <button onClick={() => setSelectedContactForMessage({name: amb.pic, phone: amb.phone || ''})} className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><MessageSquare className="w-4 h-4" /></button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  </section>
                )}
              </div>
           </div>
        </div>
      )}

      {/* QUICK MESSAGE SELECTOR SHEET */}
      {selectedContactForMessage && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedContactForMessage(null)}></div>
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] shadow-2xl relative z-10 p-8 pb-12 animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Pilih Mesej Pantas</h3>
                   <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Kepada: {selectedContactForMessage.name}</p>
                </div>
                <button onClick={() => setSelectedContactForMessage(null)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
             </div>

             <div className="space-y-3">
                {activeProgram?.quickMessages?.map((msg, idx) => (
                   <button 
                     key={idx}
                     onClick={() => handleQuickMessageSend(msg, false)}
                     className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-indigo-600 hover:text-white transition-all"
                   >
                      <span className="font-bold text-sm text-left">"{msg}"</span>
                      <Send className="w-4 h-4 opacity-30 group-hover:opacity-100" />
                   </button>
                ))}
                
                <button 
                  onClick={() => handleQuickMessageSend('', false)}
                  className="w-full p-6 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-between font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                >
                   <span>Mesej Khas (WhatsApp)</span>
                   <Edit3 className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => handleQuickMessageSend('KECEMASAN: PERLUKAN BANTUAN SEGERA!', true)}
                  className="w-full p-6 bg-red-600 text-white rounded-2xl flex items-center justify-between font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-lg"
                >
                   <div className="flex items-center gap-3">
                      <ShieldAlert className="w-5 h-5 animate-pulse" />
                      <span>Hantar Amaran ke MECC</span>
                   </div>
                   <Send className="w-4 h-4" />
                </button>
             </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around py-3 px-2 shadow-2xl z-50 rounded-t-[2.5rem]">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'dashboard' ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
          <Activity className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Dash</span>
        </button>
        <button onClick={() => setActiveTab('referral')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'referral' ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
          <Hospital className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Maps</span>
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'attendance' ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
          <ClipboardList className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Hadir</span>
        </button>
        <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1 p-5 -mt-16 bg-red-600 rounded-full text-white shadow-2xl border-[8px] border-white transition-all active:scale-90`}>
          <FilePlus className="w-8 h-8" />
        </button>
        <button onClick={() => setShowDirectoryModal(true)} className={`flex flex-col items-center gap-1 p-2 transition-all text-slate-400 hover:text-red-600`}>
          <Contact className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Kontak</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'profile' ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
          <UserIcon className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Profil</span>
        </button>
      </nav>
    </div>
  );
};

export default ResponderLayout;
