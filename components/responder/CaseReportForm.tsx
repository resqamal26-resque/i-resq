
import React, { useState, useEffect } from 'react';
/* Added Globe to the import list from lucide-react */
import { Send, MapPin, User as UserIcon, Activity, FilePlus, Share2, Clock, Thermometer, Droplets, HeartPulse, UserCheck, MessageCircle, ShieldAlert, Globe } from 'lucide-react';
import { db } from '../../services/databaseService';
import { googleSheetService } from '../../services/googleSheetService';
import { User, Attendance, Case, Notification, Program } from '../../types';

interface CaseReportFormProps {
  user: User;
  activeTask: Attendance;
  onCaseAdded: () => void;
  showToast: (message: string, type: 'success' | 'info') => void;
  initialData?: Case | null;
}

const CaseReportForm: React.FC<CaseReportFormProps> = ({ user, activeTask, onCaseAdded, showToast, initialData }) => {
  const [patientName, setPatientName] = useState(initialData?.patientName || '');
  const [age, setAge] = useState(initialData?.age || '');
  const [gender, setGender] = useState(initialData?.gender || 'Lelaki');
  const [complaint, setComplaint] = useState(initialData?.complaint || '');
  const [consciousness, setConsciousness] = useState(initialData?.consciousness || 'Alert (Sedar)');
  const [bp, setBp] = useState(initialData?.bp || '');
  const [pr, setPr] = useState(initialData?.pr || '');
  const [temp, setTemp] = useState(initialData?.temp || '');
  const [dxt, setDxt] = useState(initialData?.dxt || '');
  const [treatment, setTreatment] = useState(initialData?.treatment || '');
  const [medicName, setMedicName] = useState(initialData?.medicName || user.name);
  const [startTime, setStartTime] = useState(initialData?.startTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [status, setStatus] = useState(initialData?.status || 'Stabil');
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(initialData ? { lat: initialData.latitude, lng: initialData.longitude } : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedCase, setLastSavedCase] = useState<Case | null>(null);
  const [progState, setProgState] = useState(user.state);

  useEffect(() => {
    if (!initialData) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn("GPS Signal unavailable.")
      );
      // Auto-fill from activeTask
      setProgState(activeTask.state || user.state);
    } else {
      setProgState(initialData.state);
    }
  }, [initialData, activeTask, user.state]);

  const generateWhatsAppTemplate = (data: Case) => {
    const mapsLink = (data.latitude === 0 && data.longitude === 0)
      ? "N/A"
      : `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

    const text = `
🚀 *RESQ AMAL - LAPORAN KES* 🚀

🆔 *ID Kes:* ${data.id}
📅 *Waktu:* ${new Date(data.timestamp).toLocaleString()}
👤 *Petugas:* ${data.responderName}
📍 *Program:* ${activeTask.programName || activeTask.programId} (@${data.checkpoint})
🌍 *Negeri:* ${data.state}

👤 *DATA PESAKIT:*
- *Nama:* ${data.patientName}
- *Umur:* ${data.age}
- *Jantina:* ${data.gender}

🚑 *PENILAIAN KLINIKAL:*
- *Aduan:* ${data.complaint}
- *Kesedaran:* ${data.consciousness}
- *Vital Sign:* 
  • BP: ${data.bp || 'N/A'}
  • PR: ${data.pr || 'N/A'} bpm
  • Temp: ${data.temp || 'N/A'}°C
  • DXT: ${data.dxt || 'N/A'} mmol/L

🛠 *RAWATAN:*
- *Tindakan:* ${data.treatment}
- *Masa:* ${data.startTime} - ${data.endTime || 'Semasa'}
- *Perawat:* ${data.medicName}

✅ *STATUS AKHIR:* *${data.status.toUpperCase()}*
🔗 *Lokasi:* ${mapsLink}

_Dihantar melalui resQ Amal System_
    `.trim();
    return encodeURIComponent(text);
  };

  const handleWhatsAppShare = () => {
    if (!lastSavedCase) return;
    const url = `https://wa.me/?text=${generateWhatsAppTemplate(lastSavedCase)}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const finalLat = location ? location.lat : 0;
    const finalLng = location ? location.lng : 0;
    let finalCaseData: Case;

    const isDemo = user.id.includes('DEMO') || user.name.toLowerCase().includes('demo');

    if (initialData) {
      finalCaseData = {
        ...initialData,
        patientName, age, gender, complaint, consciousness, bp, pr, temp, dxt, treatment, medicName, startTime, endTime, status,
        latitude: finalLat,
        longitude: finalLng,
        state: progState,
        remark: isDemo ? 'DEMO' : ''
      };
      await db.updateCase(finalCaseData);
    } else {
      const newId = await db.generateCaseId();
      finalCaseData = {
        id: newId,
        programId: activeTask.programId,
        programName: activeTask.programName,
        state: progState,
        responderName: user.name,
        checkpoint: activeTask.checkpoint,
        patientName, age, gender, complaint, consciousness, bp, pr, temp, dxt, treatment, medicName, startTime, endTime, status,
        latitude: finalLat,
        longitude: finalLng,
        timestamp: new Date().toISOString(),
        remark: isDemo ? 'DEMO' : ''
      };
      await db.addCase(finalCaseData);

      const notification: Notification = {
        id: `NOTIF_${Date.now()}`,
        programId: activeTask.programId,
        senderName: user.name,
        message: `Laporan Kes Baru: [${newId}] ${patientName} (${status}) di ${activeTask.checkpoint}`,
        timestamp: new Date().toISOString(),
        type: 'case'
      };
      await db.addNotification(notification);
    }

    try {
      await googleSheetService.syncData(user.spreadsheetId, [{
        type: 'cases',
        payload: {
          id: finalCaseData.id,
          programId: finalCaseData.programId,
          state: finalCaseData.state,
          responderName: finalCaseData.responderName,
          checkpoint: finalCaseData.checkpoint,
          patientName: finalCaseData.patientName,
          complaint: finalCaseData.complaint,
          bp: finalCaseData.bp,
          pr: finalCaseData.pr,
          temp: finalCaseData.temp,
          dxt: finalCaseData.dxt,
          treatment: finalCaseData.treatment,
          status: finalCaseData.status,
          timestamp: finalCaseData.timestamp,
          latitude: finalCaseData.latitude,
          longitude: finalCaseData.longitude,
          remark: finalCaseData.remark
        }
      }]);
    } catch (err) {
      console.error("Cloud Sync Error:", err);
    }
    
    setLastSavedCase(finalCaseData);
    setIsSubmitting(false);
    showToast(initialData ? "Laporan dikemaskini!" : "Laporan berjaya dihantar!", "success");
  };

  if (lastSavedCase) {
    return (
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-green-100 animate-in zoom-in-95 duration-500 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <UserCheck className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">
          {initialData ? 'Dikemaskini!' : 'Laporan Berjaya'}
        </h2>
        <div className="bg-slate-50 p-4 rounded-2xl mb-6">
          <p className="text-[10px] font-black uppercase text-slate-400">ID KES JANAAN</p>
          <p className="text-2xl font-black text-red-600 tracking-tighter">{lastSavedCase.id}</p>
        </div>
        
        <div className="space-y-4">
          <button onClick={handleWhatsAppShare} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 text-lg transition-all">
            <MessageCircle className="w-6 h-6" /> WhatsApp MECC
          </button>
          <button onClick={() => onCaseAdded()} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-3xl text-xs uppercase tracking-widest transition-all">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 pb-12">
      <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3 uppercase mb-8">
        <FilePlus className="w-7 h-7 text-red-600" />
        {initialData ? 'Kemaskini Kes' : 'Laporan Kes Baru'}
      </h2>

      <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 w-fit">
         <Globe className="w-3 h-3" />
         <span className="text-[8px] font-black uppercase tracking-widest">Konteks: {progState}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="space-y-5">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold" placeholder="Nama Pesakit" required />
              <div className="grid grid-cols-2 gap-4">
                 <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold" placeholder="Umur" required />
                 <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold"><option>Lelaki</option><option>Perempuan</option></select>
              </div>
           </div>
           <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold min-h-[100px]" placeholder="Aduan Pesakit..." required />
           <select value={consciousness} onChange={(e) => setConsciousness(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold">
              <option>Alert (Sedar)</option>
              <option>Verbal (Respon Suara)</option>
              <option>Pain (Respon Sakit)</option>
              <option>Unresponsive (Tiada Respon)</option>
           </select>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <input type="text" value={bp} onChange={(e) => setBp(e.target.value)} placeholder="BP (120/80)" className="p-4 rounded-xl border bg-slate-50 font-bold text-sm" />
           <input type="number" value={pr} onChange={(e) => setPr(e.target.value)} placeholder="PR (bpm)" className="p-4 rounded-xl border bg-slate-50 font-bold text-sm" />
           <input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="Temp (°C)" className="p-4 rounded-xl border bg-slate-50 font-bold text-sm" />
           <input type="number" step="0.1" value={dxt} onChange={(e) => setDxt(e.target.value)} placeholder="DXT" className="p-4 rounded-xl border bg-slate-50 font-bold text-sm" />
        </section>

        <section className="space-y-4">
           <textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-slate-50 font-bold min-h-[80px]" placeholder="Rawatan Diberikan..." required />
           <div className="grid grid-cols-3 gap-3">
              {['Stabil', 'Rawatan', 'Rujuk'].map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)} className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${status === s ? 'border-red-600 bg-red-50 text-red-600' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                  {s}
                </button>
              ))}
           </div>
        </section>

        <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 text-xl transition-all">
          <Send className="w-7 h-7" /> {isSubmitting ? 'Menghantar...' : (initialData ? 'Kemaskini Laporan' : 'Simpan Laporan')}
        </button>
      </form>
    </div>
  );
};

export default CaseReportForm;
