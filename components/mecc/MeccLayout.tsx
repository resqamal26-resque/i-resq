
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Program, Case, Attendance, Notification, UserRole } from '../../types';
import { 
  Activity, 
  MapPin, 
  Settings, 
  LogOut, 
  X,
  Calendar,
  Clock,
  Bell,
  Truck,
  ShieldCheck,
  LayoutDashboard,
  History,
  ShieldAlert,
  Smartphone,
  ArrowLeftCircle,
  MessageCircle,
  UserCheck,
  FilePlus,
  Contact,
  AlertTriangle,
  UserX,
  Wifi,
  WifiOff,
  Navigation,
  Loader2,
  Menu,
  MessageSquare,
  Briefcase,
  ExternalLink,
  Edit3,
  Share2,
  Globe,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { db } from '../../services/databaseService';
import ProgramManagement from './ProgramManagement';
import DirectoryManagement from './DirectoryManagement';
import SettingsTab from './SettingsTab';
import CoordinatorDashboard from './CoordinatorDashboard';
import AttendanceList from './AttendanceList';
import NearbyReferrals from '../responder/NearbyReferrals';
import { googleSheetService } from '../../services/googleSheetService';
import { formatMyDate } from '../../App';

interface MeccLayoutProps {
  user: User;
  onLogout: () => void;
}

const MeccLayout: React.FC<MeccLayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'case' | 'attendance' | 'logout' | 'message' | 'info' } | null>(null);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  
  const handleVerifyAttendance = async (att: Attendance, status: 'Verified' | 'Rejected') => {
    try {
      const updated = { ...att, status };
      await db.updateAttendance(updated);
      await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'attendance',
        payload: updated
      }]);
      setAttendance(prev => prev.map(a => a.id === att.id ? updated : a));
      showToast(`Kehadiran ${att.responderName} telah ${status === 'Verified' ? 'disahkan' : 'ditolak'}`, 'info');
    } catch (error) {
      showToast('Gagal mengemaskini status kehadiran', 'info');
    }
  };
  
  // Status States
  const [connStatus, setConnStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [gpsStatus, setGpsStatus] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const lastNotifId = useRef<string | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);

  const showToast = useCallback((message: string, type: any = 'info') => {
    setToast({ message, type });
    try {
      if (['case', 'attendance'].includes(type)) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      }
    } catch (e) {}
    setTimeout(() => setToast(null), 6000);
  }, []);

  const checkConnectivity = useCallback(async () => {
    try {
      const result = await googleSheetService.testConnection();
      setConnStatus(result.status === 'success' ? 'online' : 'offline');
    } catch {
      setConnStatus('offline');
    }
  }, []);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const programs = await db.getPrograms();
      const active = programs.find(p => p.status === 'Active' && (p.state === user.state || p.state === 'CENTER' || user.role === UserRole.MECC_HQ));
      
      const [allCases, allNotifs, allAttendance] = await Promise.all([
        db.getCases(),
        db.getNotifications(),
        db.getAttendance()
      ]);

      if (user.role === UserRole.MECC_HQ) {
        // HQ sees everything
        setCases(allCases.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setNotifications(allNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setAttendance(allAttendance.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } else if (active) {
        setActiveProgram(active);
        const progCases = allCases.filter(c => c.programId === active.id);
        const progNotifs = allNotifs.filter(n => n.programId === active.id);
        const progAttendance = allAttendance.filter(a => a.programId === active.id);

        setCases(progCases.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setNotifications(progNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setAttendance(progAttendance.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }

      const latestNotifs = user.role === UserRole.MECC_HQ ? allNotifs : (active ? allNotifs.filter(n => n.programId === active.id) : []);
      if (latestNotifs.length > 0) {
        const latest = latestNotifs[0];
        if (latest.id !== lastNotifId.current && !isInitial) {
          showToast(latest.message, latest.type);
          lastNotifId.current = latest.id;
        } else if (isInitial) {
          lastNotifId.current = latest.id;
        }
      }
      const logs = JSON.parse(localStorage.getItem('resq_session_logs') || '[]');
      setSessionLogs(logs);
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, [user.state, showToast]);

  useEffect(() => {
    fetchData(true);
    checkConnectivity();
    
    // GPS Tracking
    const watchId = navigator.geolocation.watchPosition(
      () => setGpsStatus(true),
      () => setGpsStatus(false),
      { enableHighAccuracy: true }
    );

    const interval = setInterval(() => {
      fetchData(false);
      checkConnectivity();
    }, 12000); 

    return () => {
      clearInterval(interval);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [fetchData, checkConnectivity]);

  const navigationItems = useMemo(() => [
    { id: 'main', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'cases', label: 'Kes Kecemasan', icon: <Briefcase className="w-5 h-5" />, badge: cases.length },
    { id: 'attendance', label: 'Kehadiran', icon: <ClipboardList className="w-5 h-5" />, badge: attendance.length },
    { id: 'notifications', label: 'Log Mesej', icon: <Bell className="w-5 h-5" />, badge: notifications.length },
    { id: 'directory', label: 'Direktori', icon: <Contact className="w-5 h-5" /> },
    { id: 'programs', label: 'Program', icon: <MapPin className="w-5 h-5" /> },
    { id: 'security', label: 'Sesi Pentadbir', icon: <History className="w-5 h-5" />, adminOnly: true },
    { id: 'settings', label: 'Konfigurasi', icon: <Settings className="w-5 h-5" />, adminOnly: true }
  ], [notifications.length, cases.length]);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-inter">
      {toast && (
        <div className="fixed top-6 right-6 z-[200] animate-in slide-in-from-right-10 fade-in duration-500 w-full max-w-sm">
          <div className={`p-6 rounded-[2.5rem] shadow-2xl border flex items-start gap-4 ${
            toast.type === 'case' ? 'bg-red-600 border-red-500 text-white' :
            toast.type === 'attendance' ? 'bg-indigo-600 border-indigo-500 text-white' :
            toast.type === 'logout' ? 'bg-slate-900 border-slate-800 text-white' : 
            toast.type === 'message' ? 'bg-amber-500 border-amber-400 text-white' :
            'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="shrink-0 p-3 bg-white/20 rounded-2xl shadow-inner">
              {toast.type === 'case' ? <FilePlus className="w-6 h-6" /> : 
               toast.type === 'attendance' ? <UserCheck className="w-6 h-6" /> : 
               toast.type === 'logout' ? <UserX className="w-6 h-6" /> : 
               toast.type === 'message' ? <MessageSquare className="w-6 h-6" /> :
               <Bell className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <p className="font-black text-[9px] uppercase tracking-widest opacity-70 mb-1">
                {toast.type === 'case' ? 'Kecemasan Baru' : 
                 toast.type === 'message' ? 'Mesej Responder' :
                 'Status Petugas'}
              </p>
              <p className="font-bold text-sm leading-tight">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="opacity-40 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {isMobileOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300" onClick={() => setIsMobileOpen(false)}></div>}

      <aside className={`fixed lg:relative z-[70] h-screen bg-slate-950 flex flex-col shrink-0 transition-all duration-500 ease-in-out shadow-2xl border-r border-white/5 ${isCollapsed ? 'w-24' : 'w-80'} ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-600 rounded-2xl shadow-xl shadow-red-900/40 transform -rotate-6"><Activity className="w-6 h-6 text-white" /></div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">resQ Amal</h1>
          </div>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] ml-1">{user.state} CONTROL CENTER</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navigationItems.map(item => (!item.adminOnly || user.role === UserRole.MECC || user.role === UserRole.MECC_HQ) && (
            <button 
              key={item.id} 
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileOpen(false);
              }} 
              className={`w-full flex items-center justify-between px-6 py-4 rounded-3xl transition-all duration-300 font-bold text-sm ${activeTab === item.id ? 'bg-red-600 text-white shadow-2xl translate-x-2' : 'text-slate-500 hover:text-white'}`}
            >
              <div className="flex items-center gap-4">{item.icon}{item.label}</div>
              {item.badge ? <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === item.id ? 'bg-white text-red-600' : 'bg-red-600 text-white'}`}>{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-slate-900">
          <button onClick={onLogout} className="flex items-center gap-4 px-6 py-4 text-slate-500 hover:text-red-500 transition-all w-full font-black uppercase text-[9px] tracking-widest group">
            <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" /> Log Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-200 px-6 py-5 shrink-0 z-40">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMobileOpen(true)} className="p-2 lg:hidden bg-slate-100 text-slate-600 rounded-xl">
                 <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-slate-900 font-black text-xl lg:text-3xl tracking-tighter uppercase leading-none">
                {navigationItems.find(n => n.id === activeTab)?.label || activeTab.toUpperCase()}
              </h2>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2">
                <div 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                    connStatus === 'online' ? 'bg-green-50 border-green-200 text-green-600' : 
                    connStatus === 'offline' ? 'bg-red-50 border-red-200 text-red-600' : 
                    'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                  title={`Status Backend: ${connStatus.toUpperCase()}`}
                >
                  {connStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                   connStatus === 'online' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">Backend</span>
                </div>
                
                <div 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all shadow-sm ${
                    gpsStatus ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                  title={`Status GPS: ${gpsStatus ? 'AKTIF' : 'TIADA ISYARAT'}`}
                >
                  <Navigation className={`w-3.5 h-3.5 ${gpsStatus ? 'animate-pulse' : ''}`} />
                  <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">GPS</span>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-lg border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{user.name}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-12 bg-slate-50/50 scroll-smooth pb-40 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-12">
            {activeTab === 'main' && (
              <div className="space-y-10 animate-in fade-in duration-700">
                {activeProgram ? (
                  <>
                    {/* ACTIVE PROGRAM CARD */}
                    <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="px-4 py-1 bg-red-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest inline-block mb-2">Program Aktif</div>
                           {activeProgram.level === 'Pusat' && (
                              <div className="px-4 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest inline-block mb-2 flex items-center gap-1">
                                <Globe className="w-3 h-3" /> HQ National
                              </div>
                           )}
                        </div>
                        <h3 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-none">{activeProgram.name}</h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-red-500" /> {activeProgram.location} • <Calendar className="w-4 h-4 text-blue-500" /> {activeProgram.date}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => setShowReferralModal(true)} className="px-8 py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Pusat Rujukan AI</button>
                        <button onClick={() => setActiveTab('directory')} className="px-8 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2">
                          <Contact className="w-4 h-4 text-red-500" /> Urus Direktori
                        </button>
                      </div>
                    </div>

                    <CoordinatorDashboard 
                      activeProgram={activeProgram}
                      cases={cases}
                      attendance={attendance}
                    />
                  </>
                ) : (
                  <div className="py-48 text-center flex flex-col items-center">
                    <AlertTriangle className="w-24 h-24 text-slate-200 mb-8" />
                    <h3 className="text-3xl font-black text-slate-400 uppercase tracking-tighter">Tiada Acara Aktif</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Sila aktifkan program di tab 'Konfigurasi'</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cases' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-8">
                   <div className="flex justify-between items-center mb-8">
                      <div>
                         <h3 className="text-xl font-black uppercase tracking-tighter italic">Pangkalan Data Kes Lapangan</h3>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acara: {activeProgram?.name || 'Tiada Program'}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200">{cases.length} Kes Total</span>
                      </div>
                   </div>

                   <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b">
                           <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                              <th className="px-6 py-5">Waktu / ID</th>
                              <th className="px-6 py-5">Pesakit</th>
                              <th className="px-6 py-5">Aduan / Masalah</th>
                              <th className="px-6 py-5">Lokasi (CP)</th>
                              <th className="px-6 py-5">Status</th>
                              <th className="px-6 py-5">Tindakan</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y">
                           {cases.length === 0 ? (
                             <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-[9px] tracking-widest">Tiada rekod kes direkodkan</td></tr>
                           ) : (
                             cases.map(c => (
                               <tr key={c.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                                 <td className="px-6 py-5">
                                    <p className="font-mono text-red-600">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-[8px] opacity-40">{c.id}</p>
                                 </td>
                                 <td className="px-6 py-5 uppercase">
                                    {c.patientName}
                                    <p className="text-[8px] opacity-40">{c.age} thn • {c.gender}</p>
                                 </td>
                                 <td className="px-6 py-5 italic max-w-xs truncate">"{c.complaint}"</td>
                                 <td className="px-6 py-5 uppercase text-[10px]">{c.checkpoint}</td>
                                 <td className="px-6 py-5">
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                                      c.status === 'Stabil' ? 'bg-green-100 text-green-700' : 
                                      c.status === 'Rujuk' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                       {c.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-5">
                                    <a 
                                      href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} 
                                      target="_blank" rel="noopener noreferrer"
                                      className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-all inline-block"
                                    >
                                       <MapPin className="w-4 h-4 text-indigo-600" />
                                    </a>
                                 </td>
                               </tr>
                             ))
                           )}
                        </tbody>
                      </table>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                 {notifications.length === 0 ? (
                   <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
                      <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Tiada Log Mesej Baharu</p>
                   </div>
                 ) : (
                   notifications.map(n => (
                     <div key={n.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-start gap-4 hover:border-red-200 transition-all shadow-sm">
                        <div className={`p-3 rounded-2xl shrink-0 shadow-inner ${
                          n.type === 'case' ? 'bg-red-100 text-red-600' : 
                          n.type === 'attendance' ? 'bg-indigo-100 text-indigo-600' : 
                          n.type === 'logout' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {n.type === 'case' ? <FilePlus className="w-5 h-5" /> : 
                           n.type === 'attendance' ? <UserCheck className="w-5 h-5" /> : 
                           n.type === 'logout' ? <UserX className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-slate-800 leading-tight">{n.message}</p>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap ml-4">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                           </div>
                           <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{n.senderName} • {formatMyDate(n.timestamp)}</p>
                        </div>
                     </div>
                   ))
                 )}
              </div>
            )}

            {activeTab === 'attendance' && <AttendanceList attendance={attendance} user={user} onVerify={handleVerifyAttendance} />}

            {activeTab === 'directory' && <DirectoryManagement user={user} activeProgram={activeProgram} />}

            {activeTab === 'programs' && <ProgramManagement user={user} />}
            {activeTab === 'security' && (
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100">
                <h3 className="text-xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4"><History className="w-6 h-6 text-red-600" /> Log Sesi Terkini</h3>
                <div className="space-y-4">
                  {sessionLogs.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-slate-200 transition-all">
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase">{log.userName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.role} • {log.action}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-800">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatMyDate(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'settings' && <SettingsTab user={user} />}
          </div>
        </main>
      </div>

      {showReferralModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowReferralModal(false)}></div>
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Pusat Rujukan Fasiliti Kesihatan</h3>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Dikuasakan oleh Gemini AI Engine</p>
                 </div>
                 <button onClick={() => setShowReferralModal(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar">
                 <NearbyReferrals />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MeccLayout;
