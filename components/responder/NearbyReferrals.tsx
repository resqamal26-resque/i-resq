
import React, { useState, useEffect } from 'react';
import { Hospital as HospitalIcon, Navigation, ExternalLink, RefreshCw } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { Hospital } from '../../types';

const NearbyReferrals: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHospitals = async () => {
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const results = await geminiService.getNearbyHospitals(pos.coords.latitude, pos.coords.longitude);
          setHospitals(results);
        } catch (err) {
          setError('Gagal mendapatkan senarai hospital.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Akses GPS diperlukan.');
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Hospital & Klinik Berhampiran</h2>
        <button 
          onClick={fetchHospitals}
          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
          <div className="animate-bounce mb-4">
            <HospitalIcon className="w-12 h-12 text-red-600" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Menganalisis lokasi anda...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-6 rounded-2xl text-center border border-red-100">
          <p className="text-red-600 font-bold mb-2">Ops!</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hospitals.map((h, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
              <div className="bg-red-50 p-3 rounded-xl">
                <HospitalIcon className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 leading-tight mb-1">{h.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{h.address}</p>
                <div className="flex gap-2">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + h.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors"
                  >
                    <Navigation className="w-3 h-3" />
                    Navigasi
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-slate-900 rounded-xl text-slate-300 text-[10px] leading-relaxed">
        <p className="font-bold text-red-400 mb-1 uppercase tracking-wider">Peringatan AI:</p>
        Keputusan dijana oleh AI berdasarkan koordinat GPS anda. Sila sahkan lokasi sebelum pergerakan ambulans.
      </div>
    </div>
  );
};

export default NearbyReferrals;
