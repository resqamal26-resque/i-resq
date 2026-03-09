
import React, { useState, useEffect } from 'react';
import { Program, CheckpointDetail, AmbulanceDetail, User } from '../../types';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { 
  MapPin, 
  Truck, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Phone, 
  User as UserIcon,
  Search,
  ChevronRight,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface DirectoryManagementProps {
  user: User;
  activeProgram: Program | null;
}

const DirectoryManagement: React.FC<DirectoryManagementProps> = ({ user, activeProgram }) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(activeProgram);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    const all = await db.getPrograms();
    setPrograms(all.filter(p => p.status !== 'Completed'));
    if (!selectedProgram && activeProgram) {
      setSelectedProgram(activeProgram);
    }
  };

  const handleSave = async () => {
    if (!selectedProgram) return;
    setIsSubmitting(true);
    try {
      await db.updateProgram(selectedProgram);
      await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'programs',
        payload: selectedProgram
      }]);
      alert("Direktori berjaya dikemaskini!");
    } catch (error) {
      alert("Gagal mengemaskini direktori ke Cloud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCheckpoint = () => {
    if (!selectedProgram) return;
    const newCp: CheckpointDetail = {
      id: `CP_${Date.now()}`,
      callsign: '',
      location: '',
      pic: '',
      phone: '',
      staff: []
    };
    setSelectedProgram({ ...selectedProgram, checkpoints: [...selectedProgram.checkpoints, newCp] });
  };

  const updateCheckpoint = (id: string, field: keyof CheckpointDetail, value: any) => {
    if (!selectedProgram) return;
    setSelectedProgram({
      ...selectedProgram,
      checkpoints: selectedProgram.checkpoints.map(cp => cp.id === id ? { ...cp, [field]: value } : cp)
    });
  };

  const removeCheckpoint = (id: string) => {
    if (!selectedProgram) return;
    setSelectedProgram({
      ...selectedProgram,
      checkpoints: selectedProgram.checkpoints.filter(cp => cp.id !== id)
    });
  };

  const addAmbulance = () => {
    if (!selectedProgram) return;
    const newAmb: AmbulanceDetail = {
      id: `AMB_${Date.now()}`,
      callsign: '',
      noPlate: '',
      location: '',
      pic: '',
      phone: '',
      crew: []
    };
    setSelectedProgram({ ...selectedProgram, ambulances: [...selectedProgram.ambulances, newAmb] });
  };

  const updateAmbulance = (id: string, field: keyof AmbulanceDetail, value: any) => {
    if (!selectedProgram) return;
    setSelectedProgram({
      ...selectedProgram,
      ambulances: selectedProgram.ambulances.map(amb => amb.id === id ? { ...amb, [field]: value } : amb)
    });
  };

  const removeAmbulance = (id: string) => {
    if (!selectedProgram) return;
    setSelectedProgram({
      ...selectedProgram,
      ambulances: selectedProgram.ambulances.filter(amb => amb.id !== id)
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-100">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Pengurusan Direktori</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checkpoint & Ambulans Lapangan</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={selectedProgram?.id || ''} 
            onChange={(e) => {
              const prog = programs.find(p => p.id === e.target.value);
              if (prog) setSelectedProgram(prog);
            }}
            className="flex-1 md:w-64 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-red-500/10"
          >
            <option value="" disabled>Pilih Program...</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
            ))}
          </select>
          <button 
            onClick={fetchPrograms}
            className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!selectedProgram ? (
        <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
          <AlertTriangle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Sila Pilih Program</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Pilih program dari senarai di atas untuk menguruskan direktori</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Checkpoints Management */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                <MapPin className="w-5 h-5 text-red-600" /> Checkpoint ({selectedProgram.checkpoints.length})
              </h3>
              <button 
                onClick={addCheckpoint}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah CP
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {selectedProgram.checkpoints.map((cp, idx) => (
                <div key={cp.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                  <button 
                    onClick={() => removeCheckpoint(cp.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Callsign</label>
                        <input 
                          type="text" 
                          value={cp.callsign} 
                          onChange={(e) => updateCheckpoint(cp.id, 'callsign', e.target.value)}
                          placeholder="Cth: CP 01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-red-500/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama PIC</label>
                        <input 
                          type="text" 
                          value={cp.pic} 
                          onChange={(e) => updateCheckpoint(cp.id, 'pic', e.target.value)}
                          placeholder="Nama Penjaga"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-red-500/10"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                      <input 
                        type="text" 
                        value={cp.phone || ''} 
                        onChange={(e) => updateCheckpoint(cp.id, 'phone', e.target.value)}
                        placeholder="No. Telefon WhatsApp"
                        className="w-full pl-10 pr-4 py-3 bg-emerald-50/30 border border-emerald-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {selectedProgram.checkpoints.length === 0 && (
                <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiada Checkpoint Didaftarkan</p>
                </div>
              )}
            </div>
          </div>

          {/* Ambulances Management */}
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                <Truck className="w-5 h-5 text-amber-500" /> Ambulans ({selectedProgram.ambulances.length})
              </h3>
              <button 
                onClick={addAmbulance}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah AMB
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {selectedProgram.ambulances.map((amb, idx) => (
                <div key={amb.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                  <button 
                    onClick={() => removeAmbulance(amb.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Callsign / Plate</label>
                        <input 
                          type="text" 
                          value={amb.callsign} 
                          onChange={(e) => updateAmbulance(amb.id, 'callsign', e.target.value)}
                          placeholder="Cth: AMB 01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Ketua Krew</label>
                        <input 
                          type="text" 
                          value={amb.pic} 
                          onChange={(e) => updateAmbulance(amb.id, 'pic', e.target.value)}
                          placeholder="Nama PIC"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                      <input 
                        type="text" 
                        value={amb.phone || ''} 
                        onChange={(e) => updateAmbulance(amb.id, 'phone', e.target.value)}
                        placeholder="No. Telefon WhatsApp"
                        className="w-full pl-10 pr-4 py-3 bg-emerald-50/30 border border-emerald-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {selectedProgram.ambulances.length === 0 && (
                <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiada Ambulans Didaftarkan</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProgram && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-bottom-10 duration-500">
          <button 
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-widest rounded-[2.5rem] shadow-2xl flex items-center justify-center gap-4 hover:bg-slate-800 transition-all active:scale-95 border border-white/10"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 text-red-500" />}
            {isSubmitting ? "Menyimpan..." : "Simpan Direktori"}
          </button>
        </div>
      )}
    </div>
  );
};

export default DirectoryManagement;
