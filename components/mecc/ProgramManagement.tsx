
import React, { useState, useEffect } from 'react';
import { Program, User, CheckpointDetail, AmbulanceDetail, UserRole } from '../../types';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { MALAYSIAN_STATES } from '../../constants';
import { 
  Calendar, 
  MapPin, 
  X, 
  Edit3, 
  Save, 
  Plus, 
  Loader2, 
  Database,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
  Truck,
  UserPlus,
  UserMinus,
  Phone,
  MessageCircle,
  MessageSquare,
  ChevronRight,
  CloudCheck,
  CloudOff,
  RefreshCcw,
  AlertCircle
} from 'lucide-react';
import { formatMyDate } from '../../App';

interface ProgramManagementProps {
  user: User;
}

const ProgramManagement: React.FC<ProgramManagementProps> = ({ user }) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<'basic' | 'checkpoints' | 'ambulances' | 'messages'>('basic');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'synced' | 'pending' | 'failed'>>({});

  // Quick Message form state
  const [newQuickMessage, setNewQuickMessage] = useState('');

  // Form State for Adding New Program
  const [progName, setProgName] = useState('');
  const [progDate, setProgDate] = useState('');
  const [progTime, setProgTime] = useState('');
  const [progLoc, setProgLoc] = useState('');
  const [progState, setProgState] = useState(user.state === 'Global' ? 'Selangor' : user.state);

  useEffect(() => {
    fetchPrograms();
  }, [user.state]);

  const fetchPrograms = async () => {
    const all = await db.getPrograms();
    const filtered = user.role === UserRole.MECC_HQ 
      ? all 
      : all.filter(p => p.state === user.state || p.state === 'CENTER');
    setPrograms(filtered);
    
    // Initial sync status check - assume synced if from local db for now, 
    // but in real app we could verify with cloud here.
    const initialSync: Record<string, 'synced' | 'pending' | 'failed'> = {};
    filtered.forEach(p => {
      initialSync[p.id] = 'synced'; 
    });
    setSyncStatus(initialSync);
  };

  const handleResyncProgram = async (program: Program) => {
    setSyncStatus(prev => ({ ...prev, [program.id]: 'pending' }));
    try {
      const success = await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'programs',
        payload: { ...program }
      }]);
      
      if (success) {
        setSyncStatus(prev => ({ ...prev, [program.id]: 'synced' }));
      } else {
        setSyncStatus(prev => ({ ...prev, [program.id]: 'failed' }));
      }
    } catch (err) {
      setSyncStatus(prev => ({ ...prev, [program.id]: 'failed' }));
    }
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const id = `PROG_${Date.now().toString().slice(-6)}`;
    const formattedDate = formatMyDate(progDate);
    const targetState = user.role === UserRole.MECC_HQ ? progState : user.state;

    const newProgram: Program = {
      id,
      name: progName,
      date: formattedDate,
      time: progTime,
      location: progLoc,
      state: targetState,
      level: 'Negeri',
      status: 'Inactive',
      checkpoints: [],
      ambulances: [],
      quickMessages: [
        "Sila hantar Ambulans segera ke lokasi saya!",
        "Status Checkpoint: SEMUA STABIL.",
        "Sila sahkan penerimaan laporan kes.",
        "Memerlukan bekalan logistik tambahan."
      ]
    };

    setSyncStatus(prev => ({ ...prev, [id]: 'pending' }));

    try {
      // 1. Save Locally first
      await db.addProgram(newProgram);
      
      // 2. Mirror to Cloud and check success
      const success = await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'programs',
        payload: { ...newProgram }
      }]);

      if (success) {
        setSyncStatus(prev => ({ ...prev, [id]: 'synced' }));
        alert('Program Berjaya Didaftarkan & Disahkan di Cloud HQ!');
      } else {
        setSyncStatus(prev => ({ ...prev, [id]: 'failed' }));
        alert('Amaran: Program disimpan secara lokal tetapi gagal dihantar ke Cloud. Sila klik butang Sync Semula nanti.');
      }

      setShowAddModal(false);
      setProgName(''); setProgDate(''); setProgTime(''); setProgLoc('');
      fetchPrograms();
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, [id]: 'failed' }));
      alert('Ralat kritikal semasa pendaftaran program.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (editingProgram) {
      setIsSubmitting(true);
      setSyncStatus(prev => ({ ...prev, [editingProgram.id]: 'pending' }));
      try {
        await db.updateProgram(editingProgram);
        const success = await googleSheetService.syncData(user.spreadsheetId, [{
          type: 'programs',
          payload: { ...editingProgram }
        }]);
        
        if (success) {
          setSyncStatus(prev => ({ ...prev, [editingProgram.id]: 'synced' }));
          alert("Data Program & Direktori Berjaya Dikemaskini di Cloud!");
        } else {
          setSyncStatus(prev => ({ ...prev, [editingProgram.id]: 'failed' }));
          alert("Gagal mengemaskini di Cloud. Perubahan disimpan secara lokal.");
        }
        
        setEditingProgram(null);
        fetchPrograms();
      } catch (err) {
        setSyncStatus(prev => ({ ...prev, [editingProgram.id]: 'failed' }));
        alert("Ralat Cloud semasa menyimpan perubahan.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStatusChange = async (programId: string, newStatus: 'Active' | 'Inactive' | 'Completed') => {
    setIsSubmitting(true);
    setSyncStatus(prev => ({ ...prev, [programId]: 'pending' }));
    
    const all = await db.getPrograms();
    const syncItems: any[] = [];
    
    const updatedPrograms = all.map(p => {
      let status = p.status;
      if (newStatus === 'Active') {
        const isSameContext = p.state === (all.find(x => x.id === programId)?.state);
        if (isSameContext) {
          status = p.id === programId ? 'Active' : (p.status === 'Active' ? 'Inactive' : p.status) as any;
        }
      } else if (p.id === programId) {
        status = newStatus;
      }
      if (status !== p.status || p.id === programId) {
        syncItems.push({ type: 'programs', payload: { ...p, status } });
      }
      return { ...p, status };
    });

    try {
      for (const prog of updatedPrograms) {
        await db.updateProgram(prog);
      }
      
      const success = syncItems.length > 0 ? await googleSheetService.syncData(user.spreadsheetId, syncItems) : true;
      
      if (success) {
        setSyncStatus(prev => ({ ...prev, [programId]: 'synced' }));
      } else {
        setSyncStatus(prev => ({ ...prev, [programId]: 'failed' }));
      }
      
      fetchPrograms();
    } catch (err) {
      setSyncStatus(prev => ({ ...prev, [programId]: 'failed' }));
      alert("Ralat pertukaran status di Cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCheckpoint = () => {
    if (!editingProgram) return;
    const newCp: CheckpointDetail = {
      id: `CP_${Date.now()}`,
      callsign: '',
      location: '',
      pic: '',
      phone: '',
      staff: []
    };
    setEditingProgram({ ...editingProgram, checkpoints: [...editingProgram.checkpoints, newCp] });
  };

  const removeCheckpoint = (id: string) => {
    if (!editingProgram) return;
    setEditingProgram({ ...editingProgram, checkpoints: editingProgram.checkpoints.filter(cp => cp.id !== id) });
  };

  const updateCheckpoint = (id: string, field: keyof CheckpointDetail, value: any) => {
    if (!editingProgram) return;
    setEditingProgram({
      ...editingProgram,
      checkpoints: editingProgram.checkpoints.map(cp => cp.id === id ? { ...cp, [field]: value } : cp)
    });
  };

  const addAmbulance = () => {
    if (!editingProgram) return;
    const newAmb: AmbulanceDetail = {
      id: `AMB_${Date.now()}`,
      callsign: '',
      noPlate: '',
      location: '',
      pic: '',
      phone: '',
      crew: []
    };
    setEditingProgram({ ...editingProgram, ambulances: [...editingProgram.ambulances, newAmb] });
  };

  const removeAmbulance = (id: string) => {
    if (!editingProgram) return;
    setEditingProgram({ ...editingProgram, ambulances: editingProgram.ambulances.filter(amb => amb.id !== id) });
  };

  const updateAmbulance = (id: string, field: keyof AmbulanceDetail, value: any) => {
    if (!editingProgram) return;
    setEditingProgram({
      ...editingProgram,
      ambulances: editingProgram.ambulances.map(amb => amb.id === id ? { ...amb, [field]: value } : amb)
    });
  };

  const addQuickMessage = () => {
    if (!editingProgram || !newQuickMessage.trim()) return;
    const currentMessages = editingProgram.quickMessages || [];
    setEditingProgram({
      ...editingProgram,
      quickMessages: [...currentMessages, newQuickMessage.trim()]
    });
    setNewQuickMessage('');
  };

  const removeQuickMessage = (index: number) => {
    if (!editingProgram) return;
    const currentMessages = editingProgram.quickMessages || [];
    setEditingProgram({
      ...editingProgram,
      quickMessages: currentMessages.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Program Manager</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.state} Operations • Mirroring Active</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-red-200 transition-all"
        >
          <Plus className="w-4 h-4" /> Tambah Program
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 relative">
        {isSubmitting && (
          <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] z-10 rounded-[2.5rem] flex items-center justify-center">
            <div className="bg-white p-4 rounded-full shadow-lg border border-slate-100">
               <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
            </div>
          </div>
        )}

        {programs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Tiada rekod program untuk zon anda</p>
          </div>
        ) : (
          programs.map(p => (
            <div key={p.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50 ${
              p.status === 'Active' ? 'border-green-200 ring-4 ring-green-50' : 'border-slate-100'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-5">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner transition-all ${
                    p.status === 'Active' ? 'bg-green-100 text-green-600 scale-110' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">{p.name}</h3>
                      {p.level === 'Pusat' && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-widest border border-indigo-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> HQ Center
                        </span>
                      )}
                      {p.status === 'Active' && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-ping"></span>}
                      
                      {/* CLOUD VERIFICATION BADGE */}
                      <div className="ml-2">
                        {syncStatus[p.id] === 'synced' ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 animate-in fade-in zoom-in duration-500" title="Data disahkan di Cloud HQ">
                            <CloudCheck className="w-3 h-3" />
                            <span className="text-[7px] font-black uppercase tracking-tighter">HQ Sync</span>
                          </div>
                        ) : syncStatus[p.id] === 'pending' ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-100">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[7px] font-black uppercase tracking-tighter">Syncing...</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleResyncProgram(p)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-600 hover:text-white transition-all group" 
                            title="Klik untuk Sync semula ke Cloud"
                          >
                            <CloudOff className="w-3 h-3" />
                            <span className="text-[7px] font-black uppercase tracking-tighter">Local Only</span>
                            <RefreshCcw className="w-2.5 h-2.5 ml-1 group-hover:rotate-180 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-red-500"/> {p.date}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-500"/> {p.location}</span>
                      <span className="flex items-center gap-1.5"><UsersIcon className="w-3.5 h-3.5 text-indigo-400"/> {p.checkpoints.length} CP</span>
                      <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-orange-400"/> {p.ambulances.length} AMB</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {p.status !== 'Active' ? (
                    <button 
                      onClick={() => handleStatusChange(p.id, 'Active')} 
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-green-700 transition-all shadow-lg active:scale-95"
                    >
                      Aktifkan
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleStatusChange(p.id, 'Completed')} 
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Tandakan Selesai
                    </button>
                  )}
                  <button 
                    onClick={() => { setEditingProgram({ ...p }); setActiveEditTab('basic'); }} 
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    Urus
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isSubmitting && setShowAddModal(false)}></div>
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic">Program Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddProgram} className="p-10 space-y-6 bg-slate-50">
               <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Aras Program</label>
                    {user.role === UserRole.MECC_HQ ? (
                      <select 
                        value={progState} 
                        onChange={(e) => setProgState(e.target.value)} 
                        className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-red-500/10"
                      >
                        {MALAYSIAN_STATES.map(s => (
                          <option key={s.abbr} value={s.name}>{s.name.toUpperCase()}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-100 rounded-2xl">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Program Aras Negeri ({user.state})</span>
                      </div>
                    )}
                  </div>
                  <input type="text" value={progName} onChange={(e) => setProgName(e.target.value)} className="w-full px-6 py-5 rounded-[1.5rem] border bg-white font-bold" placeholder="Nama Acara" required />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" value={progDate} onChange={(e) => setProgDate(e.target.value)} className="w-full px-6 py-5 rounded-[1.5rem] border bg-white font-bold" required />
                    <input type="time" value={progTime} onChange={(e) => setProgTime(e.target.value)} className="w-full px-6 py-5 rounded-[1.5rem] border bg-white font-bold" required />
                  </div>
                  <input type="text" value={progLoc} onChange={(e) => setProgLoc(e.target.value)} className="w-full px-6 py-5 rounded-[1.5rem] border bg-white font-bold" placeholder="Lokasi Utama" required />
               </div>

               <div className="bg-amber-50 p-4 rounded-2xl flex items-start gap-3 border border-amber-100">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-800 leading-tight">Sistem akan menyelaraskan data program ini secara automatik ke Pangkalan Data HQ Pusat sebaik sahaja anda klik 'Daftar'.</p>
               </div>

               <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 text-xl">
                {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Database className="w-7 h-7" />}
                Daftar & Mirror
               </button>
            </form>
          </div>
        </div>
      )}

      {editingProgram && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => !isSubmitting && setEditingProgram(null)}></div>
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Urus Program: {editingProgram.name}</h3>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Mirroring Sync Aktif</p>
               </div>
               <button onClick={() => setEditingProgram(null)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="bg-slate-800 px-8 py-4 flex gap-6 overflow-x-auto custom-scrollbar shrink-0">
               {[
                 { id: 'basic', label: 'Asas', icon: <Edit3 className="w-4 h-4" /> },
                 { id: 'checkpoints', label: 'CP/Stesen', icon: <MapPin className="w-4 h-4" /> },
                 { id: 'ambulances', label: 'Ambulans', icon: <Truck className="w-4 h-4" /> },
                 { id: 'messages', label: 'Mesej Pantas', icon: <MessageSquare className="w-4 h-4" /> }
               ].map(tab => (
                 <button 
                  key={tab.id} 
                  onClick={() => setActiveEditTab(tab.id as any)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeEditTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                 >
                   {tab.icon} {tab.label}
                 </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 custom-scrollbar">
              {activeEditTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Program</label>
                    <input type="text" value={editingProgram.name} onChange={e => setEditingProgram({...editingProgram, name: e.target.value})} className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi</label>
                    <input type="text" value={editingProgram.location} onChange={e => setEditingProgram({...editingProgram, location: e.target.value})} className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold outline-none" />
                  </div>
                </div>
              )}

              {activeEditTab === 'checkpoints' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-black uppercase tracking-tighter">Direktori CP</h4>
                    <button onClick={addCheckpoint} className="px-5 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-200 transition-all flex items-center gap-2">
                       <Plus className="w-4 h-4" /> Tambah Stesen
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {editingProgram.checkpoints.map(cp => (
                      <div key={cp.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 relative group">
                        <button onClick={() => removeCheckpoint(cp.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <input type="text" value={cp.callsign} onChange={e => updateCheckpoint(cp.id, 'callsign', e.target.value)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" placeholder="Callsign Stesen" />
                          <input type="text" value={cp.pic} onChange={e => updateCheckpoint(cp.id, 'pic', e.target.value)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" placeholder="Nama P.I.C" />
                          <div className="md:col-span-2 relative">
                             <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                             <input type="text" value={cp.phone || ''} onChange={e => updateCheckpoint(cp.id, 'phone', e.target.value)} className="w-full pl-12 pr-6 py-4 bg-emerald-50/50 border border-emerald-100 rounded-xl font-bold text-sm" placeholder="No. Telefon (WhatsApp)" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeEditTab === 'ambulances' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-black uppercase tracking-tighter">Direktori Ambulans</h4>
                    <button onClick={addAmbulance} className="px-5 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-200 transition-all flex items-center gap-2">
                       <Plus className="w-4 h-4" /> Tambah Ambulans
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {editingProgram.ambulances.map(amb => (
                      <div key={amb.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 relative group">
                        <button onClick={() => removeAmbulance(amb.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <input type="text" value={amb.callsign} onChange={e => updateAmbulance(amb.id, 'callsign', e.target.value)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" placeholder="Callsign" />
                          <input type="text" value={amb.pic} onChange={e => updateAmbulance(amb.id, 'pic', e.target.value)} className="p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" placeholder="Ketua Krew" />
                          <div className="md:col-span-2 relative">
                             <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                             <input type="text" value={amb.phone || ''} onChange={e => updateAmbulance(amb.id, 'phone', e.target.value)} className="w-full pl-12 pr-6 py-4 bg-emerald-50/50 border border-emerald-100 rounded-xl font-bold text-sm" placeholder="No. Telefon (WhatsApp)" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeEditTab === 'messages' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                         <MessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tighter italic">Templat Mesej Pantas</h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disediakan untuk Responder Lapangan</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={newQuickMessage}
                        onChange={(e) => setNewQuickMessage(e.target.value)}
                        placeholder="Taip templat mesej baru..." 
                        className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <button 
                        onClick={addQuickMessage}
                        className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                      >
                        Tambah
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editingProgram.quickMessages?.map((msg, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group">
                           <p className="font-bold text-slate-700 text-sm">"{msg}"</p>
                           <button 
                             onClick={() => removeQuickMessage(idx)}
                             className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                      {(!editingProgram.quickMessages || editingProgram.quickMessages.length === 0) && (
                        <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiada templat mesej pantas</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-slate-100 shrink-0">
               <button onClick={handleSave} disabled={isSubmitting} className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 text-xl">
                {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                {isSubmitting ? "Syncing..." : "Simpan & Kemaskini Program"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramManagement;
