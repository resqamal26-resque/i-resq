
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  ArrowLeft, 
  CheckCircle, 
  ShieldCheck, 
  UserCircle, 
  Users, 
  ShieldAlert, 
  Loader2, 
  Database,
  Info
} from 'lucide-react';
import { MALAYSIAN_STATES } from '../constants';
import { db } from '../services/databaseService';
import { googleSheetService } from '../services/googleSheetService';
import { User, UserRole } from '../types';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.RESPONDER);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    
    const selectedState = MALAYSIAN_STATES.find(s => s.name === state);
    if (!selectedState) {
      setIsRegistering(false);
      return;
    }

    const timestamp = Date.now().toString().slice(-4);
    const abbr = selectedState.abbr;
    
    let prefix = 'RES';
    if (role === UserRole.MECC) prefix = 'MECC';
    if (role === UserRole.AJK) prefix = 'AJK';
    if (role === UserRole.PIC) prefix = 'PIC';
    
    const mainId = `${prefix}_${abbr}_${timestamp}`;

    const newUser: User = {
      id: mainId,
      name,
      role,
      state,
      password: role !== UserRole.RESPONDER ? password : '',
      createdAt: new Date().toISOString()
    };

    // REGISTER TO CLOUD
    try {
      const spreadsheetId = await googleSheetService.registerUser(newUser);
      newUser.spreadsheetId = spreadsheetId || undefined;
      
      // SAVE LOCALLY
      await db.addUser(newUser);
      setGeneratedIds([mainId]);
      
      // AUTOFILL LOGIN FEATURE: Store ID, Name and Role for the login page
      localStorage.setItem('resq_last_registered_id', mainId);
      localStorage.setItem('resq_last_registered_name', name);
      localStorage.setItem('resq_last_registered_role', role);
      
      setIsSuccess(true);
    } catch (err) {
      alert("Ralat pendaftaran ke pangkalan data cloud. Sila cuba lagi.");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-500 border border-slate-100">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-green-50">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Pendaftaran Berjaya!</h2>
          
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200">
               <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Database className="w-4 h-4" /></div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status Rekod Cloud</p>
            </div>
            <p className="text-slate-600 text-[11px] font-medium leading-relaxed">
              {role === UserRole.RESPONDER 
                ? "Profil anda telah didaftarkan ke Pangkalan Data HQ. Anda boleh terus log masuk tanpa memerlukan fail Spreadsheet peribadi."
                : "Profil MECC anda telah didaftarkan dan fail Spreadsheet peribadi telah dijana untuk pengurusan data anda."}
            </p>
          </div>
          
          <div className="bg-red-50 rounded-[2rem] p-8 mb-8 border border-red-100 shadow-inner">
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-red-400 mb-2">ID PETUGAS ANDA</p>
            {generatedIds.map(id => (
              <p key={id} className="text-3xl font-mono font-black text-red-600 tracking-tighter">{id}</p>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-red-200 transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            Log Masuk Sekarang
          </button>
        </div>
      </div>
    );
  }

  const roleOptions = [
    { value: UserRole.RESPONDER, label: 'Responder', icon: <UserCircle className="w-4 h-4" />, desc: 'Cloud Only' },
    { value: UserRole.MECC, label: 'MECC', icon: <ShieldCheck className="w-4 h-4" />, desc: '+Spreadsheet' },
    { value: UserRole.AJK, label: 'AJK', icon: <Users className="w-4 h-4" />, desc: 'Cloud Only' },
    { value: UserRole.PIC, label: 'PIC', icon: <ShieldAlert className="w-4 h-4" />, desc: 'Cloud Only' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 flex items-center justify-center font-inter">
      <div className="max-w-xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 border border-white/10">
        <div className="bg-red-600 px-10 py-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          
          <Link to="/login" className="text-red-100 hover:text-white flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest transition-all group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Log Masuk
          </Link>
          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase italic">Daftar Petugas</h1>
          <p className="text-red-100 text-[10px] font-bold uppercase tracking-[0.3em] opacity-80 mt-1">resQ Amal Tactical Registration</p>
        </div>

        <form onSubmit={handleRegister} className="p-8 lg:p-12 space-y-10">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Kategori Peranan</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isRegistering}
                  onClick={() => setRole(opt.value)}
                  className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl text-[10px] font-black uppercase tracking-tight border-2 transition-all relative overflow-hidden ${
                    role === opt.value 
                      ? 'border-red-600 bg-red-50 text-red-600 shadow-lg' 
                      : 'border-slate-100 text-slate-400 hover:border-slate-200 bg-slate-50/50'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nama Penuh Petugas</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none font-bold text-slate-800 transition-all text-sm placeholder:text-slate-300"
                placeholder="Cth: Ahmad Bin Abu"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Negeri Bertugas</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none font-bold text-slate-800 transition-all text-sm"
                required
              >
                <option value="">-- Pilih Negeri --</option>
                {MALAYSIAN_STATES.map(s => (
                  <option key={s.abbr} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {role !== UserRole.RESPONDER && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kata Laluan Sistem</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none font-bold text-slate-800 transition-all text-sm"
                placeholder="Mestilah sukar diteka"
                required={true}
              />
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isRegistering}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-3xl shadow-2xl shadow-red-200 transform transition-all active:scale-95 flex items-center justify-center gap-4 text-xl group"
            >
              {isRegistering ? <Loader2 className="w-7 h-7 animate-spin" /> : <UserPlus className="w-7 h-7" />}
              {isRegistering ? "Menyambung Cloud..." : "Sahkan Pendaftaran"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
