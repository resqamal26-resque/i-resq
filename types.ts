
export enum UserRole {
  RESPONDER = 'Responder',
  MECC = 'MECC',
  MECC_HQ = 'MECC HQ',
  AJK = 'AJK',
  PIC = 'PIC',
  SUPERADMIN = 'SuperAdmin'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  state: string;
  phone?: string; 
  assignment?: string;
  password?: string;
  createdAt: string;
  spreadsheetId?: string;
}

export interface CheckpointDetail {
  id: string;
  callsign: string;
  location: string;
  pic: string;
  phone?: string; 
  staff: string[];
}

export interface AmbulanceDetail {
  id: string;
  callsign: string;
  noPlate: string;
  location: string;
  pic: string;
  phone?: string; 
  crew: string[];
}

export interface Program {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  state: string;
  level: 'Negeri' | 'Pusat';
  status: 'Active' | 'Inactive' | 'Completed';
  checkpoints: CheckpointDetail[];
  ambulances: AmbulanceDetail[];
  quickMessages?: string[]; // Added for MECC-defined templates
}

export interface Case {
  id: string;
  programId: string;
  programName?: string;
  state: string;
  responderName: string;
  checkpoint: string;
  patientName: string;
  age: string;
  gender: string;
  complaint: string;
  consciousness: string;
  bp: string;
  pr: string;
  temp: string;
  dxt: string;
  treatment: string;
  medicName: string;
  startTime: string;
  endTime: string;
  status: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  remark?: string;
}

export interface Attendance {
  id: string;
  programId: string;
  programName?: string;
  programLocation?: string;
  programDate?: string;
  state: string;
  responderId: string;
  responderName: string;
  checkpoint: string;
  task?: string;
  area?: string;
  entryTime: string;
  timestamp: string;
  exitTime?: string;
  expectedExitTime?: string;
  status?: 'Pending' | 'Verified' | 'Rejected';
  location: {
    lat: number;
    lng: number;
  };
  remark?: string;
}

export interface Notification {
  id: string;
  programId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'case' | 'attendance' | 'alert' | 'logout' | 'message';
}

export interface Hospital {
  name: string;
  address: string;
  distance?: string;
  type: 'Hospital' | 'Clinic';
}
