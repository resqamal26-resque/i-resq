
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  MapPin, 
  FileText, 
  Settings, 
  Database, 
  LogOut, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Search,
  LayoutDashboard,
  Filter,
  ArrowUpRight,
  UserCheck,
  Calendar,
  AlertCircle,
  Activity,
  Server,
  Globe,
  Plus,
  Crown,
  CheckCircle,
  ArrowLeftCircle,
  Menu,
  X,
  ShieldAlert,
  Zap,
  Cpu,
  HardDrive,
  RefreshCw,
  Clock,
  Code,
  Terminal,
  Archive,
  CloudCog,
  Loader2,
  Eye,
  Info,
  ExternalLink
} from 'lucide-react';
import { User, UserRole, Program, Case } from '../../types';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { geminiService } from '../../services/geminiService';
import { formatMyDate } from '../../App';

interface SuperAdminLayoutProps {
  user: User;
  onLogout: () => void;
}

const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Detail View State
  const [selectedItem, setSelectedItem] = useState<{ type: string; data: any } | null>(null);

  // Diagnostics State
  const [diagResults, setDiagResults] = useState<{
    sheets: { status: 'idle' | 'loading' | 'success' | 'error'; latency?: number; msg: string };
    gemini: { status: 'idle' | 'loading' | 'success' | 'error'; latency?: number; msg: string };
    storage: { status: 'idle' | 'success' | 'error'; usage: string };
  }>({
    sheets: { status: 'idle', msg: 'Sedia untuk diuji' },
    gemini: { status: 'idle', msg: 'Sedia untuk diuji' },
    storage: { status: 'idle', usage: '0%' }
  });

  useEffect(() => {
    fetchAllData();
    const handleResize = () => {
      if (window.innerWidth < 1280 && window.innerWidth >= 1024) setIsCollapsed(true);
      else if (window.innerWidth >= 1280) setIsCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [allUsers, allPrograms, allCases] = await Promise.all([
        db.getUsers(),
        db.getPrograms(),
        db.getCases()
      ]);
      setUsers(allUsers);
      setPrograms(allPrograms);
      setCases(allCases);
    } catch (error) {
      console.error("SuperAdmin Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgramStatus = async (program: Program, newStatus: 'Active' | 'Inactive' | 'Completed') => {
    setIsUpdatingStatus(true);
    const updatedProgram = { ...program, status: newStatus };
    try {
      // 1. Update Local DB
      await db.updateProgram(updatedProgram);
      
      // 2. Sync to Master Sheet
      await googleSheetService.syncData(undefined, [{
        type: 'programs',
        payload: updatedProgram
      }]);
      
      // 3. Update Local State
      setPrograms(prev => prev.map(p => p.id === program.id ? updatedProgram : p));
      setSelectedItem({ type: 'Program', data: updatedProgram });
      
      alert(`Status program [${program.id}] telah dikemaskini ke ${newStatus}.`);
    } catch (err) {
      console.error("Update Status Error:", err);
      alert("Gagal mengemaskini status program.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSyncProfile = async () => {
    setIsSyncingProfile(true);
    try {
      // Direct registration to ensure master sheet has this SuperAdmin record
      await googleSheetService.registerUser(user);
      alert(`Profil HQ SuperAdmin [${user.id}] telah diselaraskan ke Master Google Sheet.`);
    } catch (err) {
      alert("Gagal menyelaraskan profil ke Cloud.");
    } finally {
      setIsSyncingProfile(false);
    }
  };

  const runFullDiagnostics = async () => {
    const usage = (JSON.stringify(localStorage).length / (5 * 1024 * 1024) * 100).toFixed(2);
    setDiagResults(prev => ({ ...prev, storage: { status: 'success', usage: `${usage}%` } }));

    setDiagResults(prev => ({ ...prev, sheets: { ...prev.sheets, status: 'loading', msg: 'Menyambung ke Google App Script...' } }));
    const sheetTest = await googleSheetService.testConnection();
    setDiagResults(prev => ({ 
      ...prev, 
      sheets: { 
        status: sheetTest.status === 'success' ? 'success' : 'error', 
        msg: sheetTest.message || 'Sambungan Backend Gagal',
        latency: 0 
      } 
    }));

    setDiagResults(prev => ({ ...prev, gemini: { ...prev.gemini, status: 'loading', msg: 'Menguji model Gemini...' } }));
    const geminiTest = await geminiService.testConnection();
    setDiagResults(prev => ({ 
      ...prev, 
      gemini: { 
        status: geminiTest.status, 
        msg: geminiTest.message,
        latency: geminiTest.latency
      } 
    }));
  };

  const handleLogoutAction = useCallback(() => {
    if (window.confirm("Sahkan untuk Keluar?\nSesi SuperAdmin akan ditamatkan.")) {
      onLogout();
    }
  }, [onLogout]);

  const handleForceLogout = useCallback(() => {
    if (window.confirm("FORCE LOGOUT?\n\nSemua data sesi dipadamkan secara total.")) {
      onLogout();
    }
  }, [onLogout]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalPrograms: programs.length,
    activePrograms: programs.filter(p => p.status === 'Active').length,
    totalCases: cases.length,
    responders: users.filter(u => u.role === UserRole.RESPONDER).length,
    meccAdmins: users.filter(u => u.role === UserRole.MECC).length,
  }), [users, programs, cases]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPrograms = programs.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCases = cases.filter(c => 
    c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-indigo-400 font-black text-xs uppercase tracking-widest animate-pulse">Mengakses Pusat Data Global...</p>
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'users', label: 'Petugas', icon: <Users className="w-5 h-5" /> },
    { id: 'programs', label: 'Programs', icon: <MapPin className="w-5 h-5" /> },
    { id: 'cases', label: 'Arkib Kes', icon: <FileText className="w-5 h-5" /> },
    { id: 'infra', label: 'Infrastruktur', icon: <Database className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-inter">
      {isMobileOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300" onClick={() => setIsMobileOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-[70] h-screen bg-slate-950 flex flex-col shrink-0 transition-all duration-500 ease-in-out shadow-2xl border-r border-white/5 ${isCollapsed ? 'w-24' : 'w-80'} ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex absolute -right-4 top-10 w-8 h-8 bg-indigo-600 text-white rounded-full items-center justify-center shadow-lg hover:bg-indigo-500 transition-colors z-[80] ring-4 ring-slate-950">
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        <div className={`p-8 mb-4 flex flex-col transition-all ${isCollapsed ? 'items-center' : 'items-start'}`}>
           <div className="flex items-center gap-4">
              <div className={`p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40 transition-transform ${isCollapsed ? 'scale-110' : ''}`}>
                 <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              {!isCollapsed && (
                <div className="animate-in fade-in duration-500 overflow-hidden">
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none whitespace-nowrap">resQ HQ</h1>
                  <p className="text-indigo-400 text-[8px] font-black uppercase tracking-[0.3em] mt-1 whitespace-nowrap">SuperAdmin Access</p>
                </div>
              )}
           </div>
           
           {/* Demo Back Link */}
           <button 
             onClick={onLogout}
             className={`mt-6 flex items-center gap-3 text-slate-500 hover:text-white transition-all group ${isCollapsed ? 'justify-center' : ''}`}
           >
             <ArrowLeftCircle className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
             {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Kembali ke Login</span>}
           </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); if (window.innerWidth < 1024) setIsMobileOpen(false); }} className={`w-full flex items-center rounded-2xl transition-all duration-300 font-bold text-sm group relative ${isCollapsed ? 'justify-center p-4' : 'px-6 py-4 gap-4'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-900/40' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
              <div className={`${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-300`}>{item.icon}</div>
              {!isCollapsed && <span className="whitespace-nowrap animate-in slide-in-from-left-2 duration-300">{item.label}</span>}
              {activeTab === item.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></div>}
            </button>
          ))}
        </nav>

        <div className={`p-4 space-y-2 border-t border-white/5 bg-slate-950/50 transition-all ${isCollapsed ? 'items-center' : ''}`}>
          <div className="space-y-1">
            <button onClick={handleLogoutAction} className={`flex items-center text-slate-500 hover:text-indigo-400 transition-all w-full text-left font-black uppercase text-[10px] tracking-widest group p-3 rounded-xl hover:bg-white/5 ${isCollapsed ? 'justify-center' : 'gap-4'}`}><LogOut className="w-5 h-5 shrink-0" />{!isCollapsed && <span>Keluar</span>}</button>
            <button onClick={handleForceLogout} className={`flex items-center text-red-500 hover:bg-red-500/10 transition-all w-full text-left font-black uppercase text-[9px] tracking-widest group p-3 rounded-xl border border-red-500/20 mt-2 ${isCollapsed ? 'justify-center' : 'gap-4'}`}><ShieldAlert className="w-5 h-5 text-red-600" />{!isCollapsed && <span>Force Logout</span>}</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-500">
        <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-5 shrink-0 z-40">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-4 lg:gap-6">
               <button onClick={() => setIsMobileOpen(true)} className="p-3 lg:hidden bg-slate-100 text-slate-600 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Menu className="w-6 h-6" /></button>
               <h2 className="text-slate-900 font-black text-xl lg:text-3xl tracking-tighter uppercase leading-none">{activeTab}</h2>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSyncProfile}
                disabled={isSyncingProfile}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-200 transition-all border border-indigo-200"
              >
                {isSyncingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudCog className="w-3 h-3" />}
                {isSyncingProfile ? 'Syncing...' : 'Simpan ID ke Cloud'}
              </button>
              <div className="relative hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Cari ID / Nama..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none w-64 lg:w-80 text-sm font-medium transition-all" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-12 bg-slate-50 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-12">
            
            {/* Tab: Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-12 animate-in fade-in duration-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Petugas Terdaftar', value: stats.totalUsers, icon: <Users className="w-6 h-6" />, color: 'indigo' },
                    { label: 'Program Aktif', value: stats.activePrograms, icon: <Activity className="w-6 h-6" />, color: 'emerald' },
                    { label: 'Jumlah Kes Direkod', value: stats.totalCases, icon: <FileText className="w-6 h-6" />, color: 'blue' },
                    { label: 'Pusat MECC', value: stats.meccAdmins, icon: <Server className="w-6 h-6" />, color: 'purple' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-4 group hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                      <div className={`p-4 bg-${s.color}-50 text-${s.color}-600 rounded-2xl w-fit group-hover:scale-110 transition-transform`}>{s.icon}</div>
                      <div><p className="text-4xl font-black text-slate-900 tracking-tighter">{s.value}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Users */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black uppercase tracking-tighter italic">Pangkalan Data Petugas</h3>
                   <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest">{filteredUsers.length} Rekod</span>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                         <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <th className="px-6 py-5">ID Petugas</th>
                            <th className="px-6 py-5">Nama Penuh</th>
                            <th className="px-6 py-5">Peranan</th>
                            <th className="px-6 py-5">Negeri</th>
                            <th className="px-6 py-5 text-right">Tindakan</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {filteredUsers.length === 0 ? (
                           <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tiada rekod ditemui</td></tr>
                         ) : (
                           filteredUsers.map(u => (
                             <tr key={u.id} className="text-xs font-bold text-slate-700 hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-6 py-5 font-mono text-indigo-600">{u.id}</td>
                                <td className="px-6 py-5 uppercase">{u.name}</td>
                                <td className="px-6 py-5">
                                   <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[8px] font-black uppercase tracking-tight text-slate-500">{u.role}</span>
                                </td>
                                <td className="px-6 py-5 uppercase text-slate-400">{u.state}</td>
                                <td className="px-6 py-5 text-right">
                                   <button onClick={() => setSelectedItem({ type: 'Petugas', data: u })} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                      <Eye className="w-4 h-4" />
                                   </button>
                                </td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* Tab: Programs */}
            {activeTab === 'programs' && (
              <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black uppercase tracking-tighter italic">Pengurusan Acara Global</h3>
                   <span className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest">{filteredPrograms.length} Acara</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {filteredPrograms.map(p => (
                     <div key={p.id} onClick={() => setSelectedItem({ type: 'Program', data: p })} className="p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-indigo-300 transition-all shadow-sm cursor-pointer group">
                        <div className="flex justify-between items-start mb-4">
                           <div className={`p-3 rounded-2xl ${p.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                              <Calendar className="w-5 h-5" />
                           </div>
                           <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${p.status === 'Active' ? 'bg-green-500 text-white animate-pulse' : 'bg-slate-300 text-white'}`}>{p.status}</span>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm uppercase mb-1 truncate">{p.name}</h4>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3">{p.state}</p>
                        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase">
                           <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {p.time}</span>
                           <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {p.location}</span>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* Tab: Cases */}
            {activeTab === 'cases' && (
              <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black uppercase tracking-tighter italic">Arkib Kes Kecemasan</h3>
                   <span className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest">{filteredCases.length} Kes</span>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                         <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <th className="px-6 py-5">Masa / ID</th>
                            <th className="px-6 py-5">Pesakit</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5">Lokasi (Negeri)</th>
                            <th className="px-6 py-5 text-right">Butiran</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {filteredCases.map(c => (
                           <tr key={c.id} className="text-xs font-bold text-slate-700 hover:bg-red-50/30 transition-colors">
                              <td className="px-6 py-5">
                                 <p className="font-mono text-red-600">{new Date(c.timestamp).toLocaleTimeString()}</p>
                                 <p className="text-[8px] opacity-40 uppercase">{c.id}</p>
                              </td>
                              <td className="px-6 py-5 uppercase">{c.patientName} <span className="text-slate-400 ml-1">({c.age})</span></td>
                              <td className="px-6 py-5">
                                 <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight ${c.status === 'Stabil' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
                              </td>
                              <td className="px-6 py-5 uppercase text-slate-400">{c.state || 'N/A'}</td>
                              <td className="px-6 py-5 text-right">
                                 <button onClick={() => setSelectedItem({ type: 'Kes Kecemasan', data: c })} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm">
                                    <Info className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              </div>
            )}

            {/* Tab: Infra */}
            {activeTab === 'infra' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex justify-between items-center mb-6">
                   <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Status Infrastruktur Global</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Sistem Diagnostik resQ HQ</p>
                   </div>
                   <button onClick={runFullDiagnostics} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
                      <RefreshCw className={`w-4 h-4 ${diagResults.sheets.status === 'loading' || diagResults.gemini.status === 'loading' ? 'animate-spin' : ''}`} /> Mulakan Diagnostik
                   </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col gap-6 group hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start">
                         <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><HardDrive className="w-6 h-6" /></div>
                         <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${diagResults.sheets.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {diagResults.sheets.status.toUpperCase()}
                         </div>
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Database: Google Sheets</h4>
                         <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">{diagResults.sheets.msg}</p>
                      </div>
                   </div>

                   <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col gap-6 group hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start">
                         <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Zap className="w-6 h-6" /></div>
                         <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${diagResults.gemini.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {diagResults.gemini.status.toUpperCase()}
                         </div>
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">AI Engine: Gemini</h4>
                         <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">{diagResults.gemini.msg}</p>
                      </div>
                   </div>

                   <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col gap-6 group hover:border-indigo-200 transition-all">
                      <div className="flex justify-between items-start">
                         <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl"><Database className="w-6 h-6" /></div>
                         <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[8px] font-black uppercase tracking-widest">LOCAL CACHE</div>
                      </div>
                      <div>
                         <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Data Persistence</h4>
                         <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">Storan pelayar tempatan ({diagResults.storage.usage} digunakan).</p>
                      </div>
                   </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedItem(null)}></div>
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/5">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">Butiran {selectedItem.type}</h3>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Rekod Pangkalan Data HQ</p>
                 </div>
                 <button onClick={() => setSelectedItem(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                 <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
                    {selectedItem.type === 'Program' && (
                      <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Kemaskini Status Program</p>
                        <div className="flex gap-2">
                          {(['Active', 'Inactive', 'Completed'] as const).map(status => (
                            <button
                              key={status}
                              disabled={isUpdatingStatus}
                              onClick={() => handleUpdateProgramStatus(selectedItem.data, status)}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                selectedItem.data.status === status 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                                  : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                              }`}
                            >
                              {isUpdatingStatus && selectedItem.data.status !== status ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : status}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.entries(selectedItem.data).map(([key, value]) => {
                      if (typeof value === 'object') return null; // Skip complex objects for simple display
                      return (
                        <div key={key} className="flex flex-col gap-1 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                           <span className="text-sm font-bold text-slate-800 break-words">{String(value) || 'N/A'}</span>
                        </div>
                      )
                    })}
                 </div>
              </div>
              <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
                 <button onClick={() => setSelectedItem(null)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Tutup</button>
                 {selectedItem.type === 'Kes Kecemasan' && (
                    <a 
                      href={`https://www.google.com/maps?q=${selectedItem.data.latitude},${selectedItem.data.longitude}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-700"
                    >
                      <MapPin className="w-4 h-4" /> Buka Lokasi
                    </a>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminLayout;
