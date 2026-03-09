
import React, { useState } from 'react';
import { Case, User } from '../../types';
import { 
  Clock, 
  MapPin, 
  Activity, 
  ChevronRight, 
  X, 
  ExternalLink, 
  MessageCircle, 
  Edit3, 
  Share2, 
  FileText, 
  Download, 
  Printer,
  FileCheck,
  Send,
  // Fix: Added missing Loader2 import from lucide-react
  Loader2
} from 'lucide-react';
import CaseReportForm from './CaseReportForm';
import { jsPDF } from 'jspdf';

interface CaseListProps {
  cases: Case[];
  onCaseUpdate?: () => void;
}

const CaseList: React.FC<CaseListProps> = ({ cases, onCaseUpdate }) => {
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showReferralPreview, setShowReferralPreview] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const getShareText = (c: Case) => {
    const mapsLink = (c.latitude === 0 && c.longitude === 0) ? "N/A" : `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
    return `*RESQ AMAL - MAKLUMAT KES*\n\n🆔 ID: ${c.id}\n👤 Nama: ${c.patientName}\n🤒 Aduan: ${c.complaint}\n🚑 Status: ${c.status}\n📍 Lokasi: ${c.checkpoint}\n🔗 Peta: ${mapsLink}`;
  };

  const handleShareTextOnly = (c: Case) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(getShareText(c))}`, '_blank');
  };

  // Helper to create the PDF document object
  const createReferralDoc = (c: Case) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(220, 38, 38); // Red-600
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("resQ Amal", 20, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SISTEM PENGURUSAN RESPONS KECEMASAN", 20, 32);
    
    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SURAT RUJUKAN PESAKIT (REFERRAL LETTER)", pageWidth / 2, 55, { align: "center" });
    
    // Meta info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`No. Rujukan: ${c.id}`, 20, 70);
    doc.text(`Tarikh/Masa: ${new Date(c.timestamp).toLocaleString()}`, 20, 76);
    doc.text(`Lokasi: ${c.checkpoint}`, 20, 82);
    
    doc.line(20, 88, pageWidth - 20, 88);

    // To section
    doc.setFont("helvetica", "bold");
    doc.text("Kepada:", 20, 100);
    doc.setFont("helvetica", "normal");
    doc.text("Pegawai Perubatan Dalam Tugas (Medical Officer on Duty)", 20, 106);
    doc.text("Jabatan Kecemasan & Trauma / Fasiliti Kesihatan Rujukan", 20, 112);
    
    // Patient Section
    doc.setFont("helvetica", "bold");
    doc.text("MAKLUMAT PESAKIT", 20, 125);
    doc.line(20, 127, 70, 127);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Nama Penuh: ${c.patientName.toUpperCase()}`, 20, 135);
    doc.text(`Umur: ${c.age} Tahun`, 20, 141);
    doc.text(`Jantina: ${c.gender}`, 20, 147);
    
    // Assessment Section
    doc.setFont("helvetica", "bold");
    doc.text("PENILAIAN KLINIKAL & ADUAN", 20, 160);
    doc.line(20, 162, 70, 162);
    
    doc.setFont("helvetica", "normal");
    doc.text("Aduan Utama:", 20, 170);
    const complaintLines = doc.splitTextToSize(c.complaint, pageWidth - 40);
    doc.text(complaintLines, 20, 176);
    
    let currentY = 176 + (complaintLines.length * 5);
    doc.text(`Tahap Kesedaran: ${c.consciousness}`, 20, currentY + 5);
    
    // Vital Signs Table
    currentY += 15;
    doc.setFillColor(248, 250, 252);
    doc.rect(20, currentY, pageWidth - 40, 25, 'F');
    doc.rect(20, currentY, pageWidth - 40, 25, 'S');
    
    doc.setFont("helvetica", "bold");
    doc.text("Tanda-tanda Vital (Vital Signs):", 25, currentY + 8);
    doc.setFont("helvetica", "normal");
    doc.text(`BP: ${c.bp || 'N/A'}`, 25, currentY + 18);
    doc.text(`PR: ${c.pr || 'N/A'} bpm`, 70, currentY + 18);
    doc.text(`Temp: ${c.temp || 'N/A'} C`, 115, currentY + 18);
    doc.text(`DXT: ${c.dxt || 'N/A'} mmol/L`, 160, currentY + 18);
    
    // Treatment Section
    currentY += 35;
    doc.setFont("helvetica", "bold");
    doc.text("RAWATAN / TINDAKAN LAPANGAN", 20, currentY);
    doc.line(20, currentY + 2, 70, currentY + 2);
    
    doc.setFont("helvetica", "normal");
    const treatmentLines = doc.splitTextToSize(c.treatment, pageWidth - 40);
    doc.text(treatmentLines, 20, currentY + 10);
    
    // Signature Section
    doc.setFont("helvetica", "bold");
    doc.text("Disahkan oleh Petugas resQ Amal:", 20, 250);
    doc.setFont("helvetica", "normal");
    doc.text(`Nama: ${c.medicName}`, 20, 260);
    doc.text(`ID Petugas: ${c.responderName}`, 20, 266);
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Surat ini dijana secara digital melalui Sistem resQ Amal Tactical.", pageWidth / 2, 285, { align: "center" });

    return doc;
  };

  const handleDownloadPDF = (c: Case) => {
    const doc = createReferralDoc(c);
    doc.save(`SURAT_RUJUKAN_${c.id}.pdf`);
  };

  const handleSharePDF = async (c: Case) => {
    setIsSharing(true);
    const doc = createReferralDoc(c);
    const pdfBlob = doc.output('blob');
    const fileName = `SURAT_RUJUKAN_${c.id}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Check if Web Share API is available and can share files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Surat Rujukan - ${c.patientName}`,
          text: `Surat rujukan rasmi resQ Amal untuk pesakit ${c.patientName}. Sila serahkan kepada pegawai perubatan bertugas.`,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Share failed", err);
          handleDownloadPDF(c);
          alert("Gagal berkongsi terus. Fail telah dimuat turun, sila lampirkan secara manual di WhatsApp.");
        }
      }
    } else {
      // Fallback for browsers without file sharing support
      handleDownloadPDF(c);
      alert("Pelayar anda tidak menyokong perkongsian fail secara terus. Fail telah dimuat turun, sila lampirkan secara manual di WhatsApp.");
    }
    setIsSharing(false);
  };

  if (cases.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200">
        <Activity className="w-8 h-8 text-slate-200 mx-auto mb-4" />
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Tiada rekod kes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senarai Kes Terkini</h2>
        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[9px] font-black">{cases.length} Kes</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {cases.map((c) => (
          <div 
            key={c.id} 
            onClick={() => setSelectedCase(c)} 
            className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-red-200 transition-all cursor-pointer group shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${
                c.status === 'Stabil' ? 'bg-green-500' : c.status === 'Rawatan' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                {c.patientName[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase text-sm truncate max-w-[180px]">{c.patientName}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {c.id}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-all" />
          </div>
        ))}
      </div>

      {selectedCase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => { setSelectedCase(null); setIsEditing(false); setShowReferralPreview(false); }}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter italic">
                    {showReferralPreview ? 'Pratinjau Surat' : (isEditing ? 'Kemaskini Kes' : 'Butiran Kes')}
                  </h3>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{selectedCase.id}</p>
               </div>
               <button onClick={() => { setSelectedCase(null); setIsEditing(false); setShowReferralPreview(false); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
              {showReferralPreview ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white border border-slate-200 p-8 shadow-inner rounded-xl space-y-6 font-serif text-slate-800 text-[11px] leading-relaxed">
                     <div className="border-b-2 border-red-600 pb-4 mb-6">
                        <h4 className="text-lg font-black text-red-600 italic">resQ Amal</h4>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Emergency Response System</p>
                     </div>
                     <div className="text-center font-bold text-sm mb-4">SURAT RUJUKAN PESAKIT</div>
                     <p>Kepada: Pegawai Perubatan Dalam Tugas</p>
                     <p>Rujukan Kes: <span className="font-bold">{selectedCase.id}</span></p>
                     <div className="space-y-1">
                        <p className="font-bold underline uppercase">Maklumat Pesakit:</p>
                        <p>Nama: {selectedCase.patientName.toUpperCase()}</p>
                        <p>Umur/Jantina: {selectedCase.age} Tahun / {selectedCase.gender}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="font-bold underline uppercase">Penilaian Klinikal:</p>
                        <p>Aduan: {selectedCase.complaint}</p>
                        <p>Kesedaran: {selectedCase.consciousness}</p>
                        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border border-slate-100 rounded mt-2">
                           <p>BP: {selectedCase.bp || '-'}</p>
                           <p>PR: {selectedCase.pr || '-'} bpm</p>
                           <p>Temp: {selectedCase.temp || '-'} C</p>
                           <p>DXT: {selectedCase.dxt || '-'} mmol/L</p>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <p className="font-bold underline uppercase">Rawatan Diberikan:</p>
                        <p>{selectedCase.treatment}</p>
                     </div>
                     <div className="pt-10">
                        <p>Disediakan Oleh:</p>
                        <p className="font-bold mt-4">{selectedCase.medicName}</p>
                        <p className="text-slate-400">Petugas resQ Amal</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleSharePDF(selectedCase)}
                      disabled={isSharing}
                      className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                      Kongsi PDF (WA)
                    </button>
                    <button 
                      onClick={() => handleDownloadPDF(selectedCase)}
                      className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
                    >
                      <Download className="w-5 h-5" /> Download PDF
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowReferralPreview(false)}
                    className="w-full py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                  >
                    Batal
                  </button>
                </div>
              ) : isEditing ? (
                <CaseReportForm 
                  user={{ name: selectedCase.responderName } as any} 
                  activeTask={{ programId: selectedCase.programId, checkpoint: selectedCase.checkpoint, programName: selectedCase.programName } as any}
                  onCaseAdded={() => { setIsEditing(false); setSelectedCase(null); onCaseUpdate?.(); }}
                  initialData={selectedCase}
                />
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl flex flex-col items-center text-center shadow-sm border border-slate-100">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white mb-3 shadow-lg ${
                      selectedCase.status === 'Stabil' ? 'bg-green-500' : selectedCase.status === 'Rawatan' ? 'bg-amber-500' : 'bg-red-500'
                    }`}>
                      {selectedCase.patientName[0]}
                    </div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedCase.patientName}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">{selectedCase.age} Tahun • {selectedCase.gender}</p>
                    <div className={`mt-3 px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                      selectedCase.status === 'Stabil' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {selectedCase.status}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Aduan / Masalah</p>
                        <p className="text-sm font-bold text-slate-700 italic">"{selectedCase.complaint}"</p>
                      </div>
                      <div className="pt-3 border-t border-slate-50">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Rawatan Diberikan</p>
                        <p className="text-sm font-medium text-slate-600">{selectedCase.treatment}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowReferralPreview(true)}
                      className="w-full flex items-center justify-between p-5 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white/20 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Jana Surat Rujukan</span>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <a 
                      href={`https://www.google.com/maps?q=${selectedCase.latitude},${selectedCase.longitude}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-[1.5rem] group hover:bg-slate-50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <MapPin className="w-5 h-5 text-red-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{selectedCase.checkpoint}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => setIsEditing(true)} className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">
                      <Edit3 className="w-4 h-4" /> Edit Kes
                    </button>
                    <button onClick={() => handleShareTextOnly(selectedCase)} className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg">
                      <Share2 className="w-4 h-4" /> Share Ringkasan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseList;
