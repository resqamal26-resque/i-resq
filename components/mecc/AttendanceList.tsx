import React from 'react';
import { Attendance, User } from '../../types';
import { 
  UserCheck, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  ClipboardList,
  Search,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Briefcase,
  Navigation
} from 'lucide-react';

interface AttendanceListProps {
  attendance: Attendance[];
  user: User;
  onVerify?: (attendance: Attendance, status: 'Verified' | 'Rejected') => void;
}

const AttendanceList: React.FC<AttendanceListProps> = ({ attendance, user, onVerify }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterState, setFilterState] = React.useState('ALL');

  const filteredAttendance = attendance.filter(a => {
    const matchesSearch = a.responderName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.programName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.checkpoint.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterState === 'ALL' || (filterState === 'BALIK AWAL' && a.remark?.includes('BALIK AWAL'));
    return matchesSearch && matchesFilter;
  });

  const exportToCSV = () => {
    const headers = ['Nama Petugas', 'Program', 'Checkpoint', 'Tugasan', 'Kawasan', 'Masa Masuk', 'Masa Keluar', 'Dijangka Keluar', 'Status/Remark'];
    const rows = filteredAttendance.map(a => [
      a.responderName,
      a.programName || '-',
      a.checkpoint,
      a.task || '-',
      a.area || '-',
      a.entryTime,
      a.exitTime || 'AKTIF',
      a.expectedExitTime || '-',
      a.remark || '-'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Kehadiran_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-red-600" /> Laporan Kehadiran Petugas
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Rekod Kehadiran Unit Medik & Responder</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Cari Petugas, Program atau Checkpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm font-bold text-sm outline-none focus:ring-4 focus:ring-red-500/10"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <select 
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm font-bold text-sm outline-none appearance-none cursor-pointer"
          >
            <option value="ALL">SEMUA REKOD</option>
            <option value="BALIK AWAL">BALIK AWAL SAHAJA</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-8 py-6">Petugas / Program</th>
                <th className="px-8 py-6">Tugasan / Kawasan</th>
                <th className="px-8 py-6">Masa Masuk</th>
                <th className="px-8 py-6">Masa Keluar</th>
                <th className="px-8 py-6">Dijangka Keluar</th>
                <th className="px-8 py-6">Status / Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <AlertTriangle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Tiada rekod kehadiran ditemui</p>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black text-xs shadow-inner">
                          {a.responderName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase leading-none mb-1">{a.responderName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-400" /> {a.programName || 'Program Am'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-slate-400" /> {a.task || 'TUGASAN AM'}
                        </p>
                        <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                          <Navigation className="w-3 h-3 text-slate-400" /> {a.area || 'KAWASAN AM'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">CP: {a.checkpoint}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" /> {a.entryTime}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        {a.exitTime ? (
                          <><Clock className="w-3.5 h-3.5 text-red-500" /> {a.exitTime}</>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Aktif</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-600">{a.expectedExitTime || '-'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${
                            a.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 
                            a.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                            a.remark?.includes('BALIK AWAL') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {a.status || (a.remark === 'ACTIVE' ? 'ACTIVE' : 'PENDING')}
                          </span>
                          
                          {onVerify && (!a.status || a.status === 'Pending') && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => onVerify(a, 'Verified')}
                                className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Sahkan Kehadiran"
                              >
                                <CheckCircle className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => onVerify(a, 'Rejected')}
                                className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                title="Tolak Kehadiran"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {a.remark && a.remark !== 'ACTIVE' && (
                          <p className="text-[8px] font-bold text-slate-400 italic max-w-[150px] leading-tight">
                            {a.remark}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceList;
