
import React from 'react';
import { 
  Activity, 
  Users, 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  UserCheck,
  Shield
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Program, Case, Attendance } from '../../types';

interface CoordinatorDashboardProps {
  activeProgram: Program | null;
  cases: Case[];
  attendance: Attendance[];
}

const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ 
  activeProgram, 
  cases, 
  attendance 
}) => {
  // Group cases by program
  const casesByProgram = React.useMemo(() => {
    const groups: Record<string, Case[]> = {};
    cases.forEach(c => {
      const progName = c.programName || 'Program Am';
      if (!groups[progName]) groups[progName] = [];
      groups[progName].push(c);
    });
    return groups;
  }, [cases]);

  // Group attendance by program
  const attendanceByProgram = React.useMemo(() => {
    const groups: Record<string, Attendance[]> = {};
    attendance.forEach(a => {
      const progName = a.programName || 'Program Am';
      if (!groups[progName]) groups[progName] = [];
      groups[progName].push(a);
    });
    return groups;
  }, [attendance]);

  // Data processing for Incident Overview
  const caseStatusData = [
    { name: 'Stabil', value: cases.filter(c => c.status === 'Stabil').length, color: '#10b981' },
    { name: 'Rujuk', value: cases.filter(c => c.status === 'Rujuk').length, color: '#ef4444' },
    { name: 'Pantau', value: cases.filter(c => c.status === 'Pantau').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Data processing for Task Progress (Cases by Checkpoint)
  const checkpointData = activeProgram ? activeProgram.checkpoints.map(cp => ({
    name: cp.callsign,
    cases: cases.filter(c => c.checkpoint === cp.callsign).length,
    responders: attendance.filter(a => a.checkpoint === cp.callsign && !a.exitTime).length
  })) : [];

  // Active Responders
  const activeResponders = attendance.filter(a => !a.exitTime);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{cases.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Kes</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">{activeResponders.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Petugas Aktif</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">
              {cases.filter(c => c.status === 'Stabil').length}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kes Stabil</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900">
              {activeProgram ? activeProgram.checkpoints.length : Object.keys(casesByProgram).length}
            </p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {activeProgram ? 'Checkpoint' : 'Program Aktif'}
            </p>
          </div>
        </div>
      </div>

      {/* Grouped View for HQ */}
      {!activeProgram && (
        <div className="space-y-12">
          {Object.entries(attendanceByProgram).map(([progName, attendees]) => (
            <div key={progName} className="space-y-6">
              <div className="flex items-center gap-4 px-4">
                <div className="h-px flex-1 bg-slate-200"></div>
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest italic">{progName}</h3>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Responders for this program */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" /> Petugas ({(attendees as Attendance[]).filter(a => !a.exitTime).length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(attendees as Attendance[]).filter(a => !a.exitTime).map(a => (
                      <div key={a.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-[10px]">
                          {a.responderName[0]}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">{a.responderName}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{a.checkpoint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cases for this program */}
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white">
                  <h4 className="text-sm font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-red-500" /> Kes Terkini ({casesByProgram[progName]?.length || 0})
                  </h4>
                  <div className="space-y-4">
                    {casesByProgram[progName]?.slice(0, 3).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">{c.patientName}</p>
                          <p className="text-[9px] font-bold text-slate-400 italic truncate">"{c.complaint}"</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          c.status === 'Stabil' ? 'bg-emerald-500/20 text-emerald-400' : 
                          c.status === 'Rujuk' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                    {!casesByProgram[progName] && <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest text-center py-4">Tiada Kes Dilaporkan</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section */}
      {activeProgram && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Incident Status Breakdown */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-600" /> Ringkasan Status Kes
          </h4>
          <div className="h-64">
            {caseStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={caseStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {caseStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <Shield className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Tiada Data Kes</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {caseStatusData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Checkpoint Activity */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-600" /> Aktiviti Mengikut Checkpoint
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkpointData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="cases" name="Kes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="responders" name="Petugas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )}

      {/* Responder Availability & Task Progress */}
      {activeProgram && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Active Responders List */}
        <div className="xl:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> Petugas Di Lapangan
            </h4>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
              {activeResponders.length} Online
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeResponders.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-300">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Tiada Petugas Aktif</p>
              </div>
            ) : (
              activeResponders.map(a => (
                <div key={a.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-100">
                      {a.responderName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase">{a.responderName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {a.checkpoint}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Aktif</p>
                    <p className="text-[8px] font-bold text-slate-400 flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5" /> {a.entryTime.split(' ')[1]} {a.entryTime.split(' ')[2]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Task Progress / Recent Activity */}
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white">
          <h4 className="text-sm font-black uppercase tracking-tighter mb-8 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" /> Log Aktiviti Terkini
          </h4>
          <div className="space-y-6">
            {cases.slice(0, 5).map((c, i) => (
              <div key={c.id} className="relative pl-6 border-l border-white/10 pb-6 last:pb-0">
                <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${
                  c.status === 'Stabil' ? 'bg-emerald-500' : 
                  c.status === 'Rujuk' ? 'bg-red-500' : 'bg-amber-500'
                } shadow-[0_0_10px_rgba(255,255,255,0.2)]`}></div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {c.checkpoint}
                  </p>
                  <p className="text-xs font-bold leading-tight">
                    Kes <span className="text-red-400">{c.patientName}</span> dilaporkan oleh <span className="text-indigo-400">{c.responderName}</span>
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 italic">"{c.complaint}"</p>
                </div>
              </div>
            ))}
            {cases.length === 0 && (
              <div className="py-12 text-center text-white/20">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Tiada Aktiviti</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default CoordinatorDashboard;
