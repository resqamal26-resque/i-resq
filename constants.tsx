
import React from 'react';
import { 
  Activity, 
  MapPin, 
  Users, 
  Settings, 
  FileText, 
  Hospital, 
  CheckCircle, 
  AlertTriangle,
  Bell,
  Contact
} from 'lucide-react';

export const MALAYSIAN_STATES = [
  { name: 'Johor', abbr: 'JHR' },
  { name: 'Kedah', abbr: 'KDH' },
  { name: 'Kelantan', abbr: 'KTN' },
  { name: 'Melaka', abbr: 'MLK' },
  { name: 'Negeri Sembilan', abbr: 'NSN' },
  { name: 'Pahang', abbr: 'PHG' },
  { name: 'Perak', abbr: 'PRK' },
  { name: 'Perlis', abbr: 'PLS' },
  { name: 'Pulau Pinang', abbr: 'PNG' },
  { name: 'Sabah', abbr: 'SBH' },
  { name: 'Sarawak', abbr: 'SRW' },
  { name: 'Selangor', abbr: 'SEL' },
  { name: 'Terengganu', abbr: 'TRG' },
  { name: 'Wilayah Persekutuan Kuala Lumpur', abbr: 'WPKL' },
  { name: 'Wilayah Persekutuan Labuan', abbr: 'WPL' },
  { name: 'Wilayah Persekutuan Putrajaya', abbr: 'WPP' }
];

export const NAV_ITEMS = {
  MECC: [
    { label: 'Main Dashboard', icon: <Activity className="w-5 h-5" />, id: 'main' },
    { label: 'Notifications', icon: <Bell className="w-5 h-5" />, id: 'notifications' },
    { label: 'Programs', icon: <MapPin className="w-5 h-5" />, id: 'programs' },
    { label: 'Referral', icon: <Hospital className="w-5 h-5" />, id: 'referral' },
    { label: 'Settings', icon: <Settings className="w-5 h-5" />, id: 'settings' }
  ],
  RESPONDER: [
    { label: 'Dashboard', icon: <Activity className="w-5 h-5" />, id: 'dashboard' },
    { label: 'Report Case', icon: <FileText className="w-5 h-5" />, id: 'report' },
    { label: 'Nearby Hospitals', icon: <Hospital className="w-5 h-5" />, id: 'referral' },
    { label: 'Direktori', icon: <Contact className="w-5 h-5" />, id: 'directory' }
  ]
};

export const CHECKPOINTS = [
  'Station A (Entry)',
  'Station B (Mid)',
  'Station C (Water Station)',
  'Station D (Finish)',
  'Mobile Unit 1',
  'Mobile Unit 2'
];
