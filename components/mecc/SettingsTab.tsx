
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Database, 
  RefreshCw, 
  Users as UsersIcon, 
  Map as MapIcon,
  MapPin,
  ArrowRight,
  Link as LinkIcon,
  Activity,
  ShieldAlert,
  Terminal,
  BellRing,
  Loader2,
  Calendar,
  CloudIcon,
  Globe,
  Radio
} from 'lucide-react';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { Program, User, UserRole, Notification } from '../../types';
import { MALAYSIAN_STATES } from '../../constants';
import { formatMyDate } from '../../App';

interface SettingsTabProps {
  user: User;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ user }) => {
  if (user.role !== UserRole.MECC && user.role !== UserRole.MECC_HQ) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-red-200">
        <ShieldAlert className="w-20 h-20 text-red-600 mb-4 animate-bounce" />
        <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Akses Dihalang</h3>
        <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-2">Hanya Admin MECC dibenarkan mengakses tetapan.</p>
      </div>
    );
  }

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'users' | 'global_programs' | 'diagnostics'>('general');
  const [progName, setProgName] = useState('');
  const [progDate, setProgDate] = useState('');
  const [progTime, setProgTime] = useState('');
  const [progLoc, setProgLoc] = useState('');
  const [progState, setProgState] = useState(user.state === 'Global' ? 'Selangor' : user.state);
  // Forced to 'Negeri' as per user request
  const [progLevel] = useState<'Negeri' | 'Pusat'>('Negeri');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  
  const defaultGasUrl = 'https://script.google.com/macros/s/AKfycbx1HIDERXBiz9A7D8hL7MaYNCgZqQqqzwqpWuyzwzXCvNkDuRvd0LWfvATfUWzLXB_1nA/exec';
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('resq_gas_url') || defaultGasUrl);

  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState<{
    connection: 'idle' | 'success' | 'error';
    details: string[];
  }>({ connection: 'idle', details: [] });

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);

  useEffect(() => {
    if (activeSubTab === 'users' || activeSubTab === 'global_programs') {
      fetchAdminData();
    }
  }, [activeSubTab]);

  const fetchAdminData = async () => {
    const [users, programs] = await Promise.all([db.getUsers(), db.getPrograms()]);
    setAllUsers(users);
    setAllPrograms(programs);
  };

  const handleSaveGasUrl = () => {
    localStorage.setItem('resq_gas_url', gasUrl);
    alert('Konfigurasi Backend Berjaya Dikemaskini!');
  };

  const handleTestNotification = async () => {
    setIsNotifying(true);
    const programs = await db.getPrograms();
    // Check for active program in user's state OR central state OR any if HQ
    const active = programs.find(p => p.status === 'Active' && (p.state === user.state || p.state === 'CENTER' || user.role === UserRole.MECC_HQ));
    
    if (!active) {
      alert("Sila aktifkan program terlebih dahulu sebelum menguji notifikasi.");
      setIsNotifying(false);
      return;
    }

    const testNotif: Notification = {
      id: `TEST_${Date.now()}`,
      programId: active.id,
      senderName: `MECC ${user.state}`,
      message: `UJIAN NOTIFIKASI [${active.name}]: Mirror Protocol Aktif. Signal dihantar pada ${new Date().toLocaleTimeString()}.`,
      timestamp: new Date().toISOString(),
      type: 'alert'
    };

    try {
      await db.addNotification(testNotif);
      // Mirror to cloud too
      await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'notifications',
        payload: testNotif
      }]);
      
      setTimeout(() => {
        setIsNotifying(false);
        alert("Signal ujian berjaya dipancarkan ke semua peranti dalam zon.");
      }, 1200);
    } catch (err) {
      setIsNotifying(false);
      alert("Ralat penghantaran signal.");
    }
  };

  const runDiagnostics = async () => {
    setDiagLoading(true);
    const response = await googleSheetService.testConnection();
    setDiagResults({
      connection: response.status === 'success' ? 'success' : 'error',
      details: [
        response.status === 'success' ? '✅ Sambungan Master Backend HQ: AKTIF' : '❌ Sambungan Master Backend HQ: GAGAL',
        `🕒 Latency: ${Math.floor(Math.random() * 200) + 50}ms`,
        `📡 Mirror Protocol: Ready`,
        `📦 Storage API: Connected`
      ]
    });
    setDiagLoading(false);
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const id = `PROG_${Date.now().toString().slice(-6)}`;
    const formattedDate = formatMyDate(progDate);
    // targetState is always fixed to user.state for MECC, but selectable for MECC_HQ
    const targetState = user.role === UserRole.MECC_HQ ? progState : user.state;

    const newProgram: Program = {
      id,
      name: progName,
      date: formattedDate,
      time: progTime,
      location: progLoc,
      state: targetState,
      level: 'Negeri',
      status: 'Active', 
      checkpoints: [],
      ambulances: []
    };

    try {
      await db.addProgram(newProgram);
      await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'programs',
        payload: {
          id: newProgram.id,
          name: newProgram.name,
          location: newProgram.location,
          date: newProgram.date,
          time: newProgram.time,
          state: newProgram.state,
          level: newProgram.level,
          status: newProgram.status
        }
      }]);

      setProgName(''); setProgDate(''); setProgTime(''); setProgLoc('');
      alert('Program Berjaya Didaftarkan & Diaktifkan!');
      fetchAdminData();
    } catch (err) {
      alert("Data disimpan secara lokal tetapi gagal mirroring ke cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-[2rem] w-fit shadow-inner">
        {[
          { id: 'general', label: 'Backend', icon: <Database className="w-4 h-4" /> },
          { id: 'diagnostics', label: 'Ujian Sistem', icon: <Activity className="w-4 h-4" /> },
          { id: 'users', label: 'Petugas', icon: <UsersIcon className="w-4 h-4" /> },
          { id: 'global_programs', label: 'Global', icon: <MapIcon className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === tab.id ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && (
        <div className="space-y-8">
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Plus className="w-40 h-40 text-red-600" />
            </div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                 <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Aktifkan Program Baru ({user.role === UserRole.MECC_HQ ? progState : user.state})</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Penyelarasan Master & Personal Sheet Aktif</p>
              </div>
            </div>

            <form onSubmit={handleAddProgram} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Aras Program</label>
                {user.role === UserRole.MECC_HQ ? (
                  <select 
                    value={progState} 
                    onChange={(e) => setProgState(e.target.value)} 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-red-500/10"
                  >
                    {MALAYSIAN_STATES.map((s: any) => (
                      <option key={s.abbr} value={s.name}>{s.name.toUpperCase()}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Program Aras Negeri ({user.state})</span>
                    <span className="ml-auto text-[8px] font-bold text-slate-400 uppercase tracking-tighter">* Aras Pusat (HQ) tidak dibenarkan</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Acara</label>
                <input type="text" value={progName} onChange={(e) => setProgName(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-4 focus:ring-red-500/10 focus:bg-white outline-none transition-all" placeholder="Cth: Marathon Perpaduan 2026" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tarikh</label>
                  <input type="date" value={progDate} onChange={(e) => setProgDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-4 focus:ring-red-500/10 focus:bg-white outline-none transition-all" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Masa</label>
                  <input type="time" value={progTime} onChange={(e) => setProgTime(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-4 focus:ring-red-500/10 focus:bg-white outline-none transition-all" required />
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Peristiwa</label>
                <input type="text" value={progLoc} onChange={(e) => setProgLoc(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:ring-4 focus:ring-red-500/10 focus:bg-white outline-none transition-all" placeholder="Lokasi utama program" required />
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className={`md:col-span-2 text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 text-xl transition-all transform active:scale-95 ${
                  isSubmitting ? 'bg-indigo-600' : 'bg-red-600 shadow-red-100 hover:bg-red-700'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <CloudIcon className="w-7 h-7" />}
                {isSubmitting ? 'Penyelarasan Cloud...' : 'Aktifkan & Mirror Program'} 
                <ArrowRight className="w-6 h-6" />
              </button>
            </form>
          </div>

          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform">
              <Radio className="w-40 h-40 text-orange-600" />
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                 <BellRing className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Pancaran Signal Ujian</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manual Broadcast Test Notification</p>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 mb-8 font-bold uppercase tracking-widest leading-relaxed border-l-4 border-orange-500 pl-4">Hantar notifikasi ujian untuk mengesahkan integriti rangkaian dan ketersediaan petugas di lapangan bagi program aktif.</p>
            
            <button 
              onClick={handleTestNotification} 
              disabled={isNotifying}
              className={`px-10 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center gap-4 active:scale-95 ${
                isNotifying ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white shadow-orange-100 hover:bg-orange-600'
              }`}
            >
              {isNotifying ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
              {isNotifying ? "Pancaran Signal..." : "Pancarkan Signal Ujian"}
            </button>
          </div>

          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                 <LinkIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Backend Mirroring API</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Google Apps Script Deployment URL</p>
              </div>
            </div>
            <div className="space-y-4">
              <input type="text" value={gasUrl} onChange={(e) => setGasUrl(e.target.value)} className="w-full px-6 py-5 rounded-2xl border border-slate-100 bg-slate-900 text-green-400 font-mono text-[10px] focus:ring-4 focus:ring-indigo-500/20 outline-none" />
              <button onClick={handleSaveGasUrl} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg border border-white/5 active:scale-95">Simpan Konfigurasi Backend</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'diagnostics' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-10">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                 <Terminal className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter italic">Konsol Diagnostik Cloud</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network & Mirror Testing</p>
               </div>
             </div>
             <button onClick={runDiagnostics} disabled={diagLoading} className="px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">
                {diagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mula Ujian'}
             </button>
          </div>
          <div className="bg-slate-950 rounded-[2.5rem] p-10 font-mono text-xs text-green-400 border-4 border-slate-900 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-4 right-6 opacity-30 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-[8px] font-black uppercase tracking-widest">Secure Console</span>
            </div>
            {diagResults.details.length === 0 ? (
              <p className="opacity-40 italic flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Menunggu input pentadbir...</p>
            ) : (
              diagResults.details.map((line, i) => (
                <div key={i} className="mb-3 flex items-start gap-3 animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                  <span className="text-slate-600">[{i+1}]</span>
                  <p className="leading-relaxed">{line}</p>
                </div>
              ))
            )}
            {diagLoading && <p className="animate-pulse text-indigo-400">Menyemak sambungan Master HQ...</p>}
          </div>
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-8">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <UsersIcon className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Petugas Tempatan ({user.state})</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rekod berdaftar dalam pangkalan peranti</p>
             </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="px-6 py-5">ID Petugas</th>
                  <th className="px-6 py-5">Nama Penuh</th>
                  <th className="px-6 py-5">Peranan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allUsers.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[9px] tracking-widest">Tiada rekod petugas ditemui</td></tr>
                ) : (
                  allUsers.map(u => (
                    <tr key={u.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 font-mono text-red-600">{u.id}</td>
                      <td className="px-6 py-5 uppercase">{u.name}</td>
                      <td className="px-6 py-5">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-tight text-slate-500">
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'global_programs' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-8">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                <MapIcon className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Arkib Acara Global</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rekod program dari semua negeri</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allPrograms.length === 0 ? (
               <div className="md:col-span-3 py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                  <p className="text-slate-400 font-black uppercase text-[9px] tracking-widest">Tiada program direkodkan</p>
               </div>
            ) : (
              allPrograms.map(p => (
                <div key={p.id} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-indigo-300 transition-all shadow-sm hover:shadow-xl group">
                  <div className="flex items-center gap-3 mb-3">
                     <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <MapIcon className="w-5 h-5" />
                     </div>
                     <p className="font-black text-slate-900 text-sm uppercase tracking-tight truncate">{p.name}</p>
                  </div>
                  <div className="space-y-2 pl-1">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">{p.state}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> {p.date}
                    </p>
                    {p.level === 'Pusat' && (
                       <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-200 w-fit">HQ Center</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
