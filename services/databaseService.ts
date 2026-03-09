
import { User, UserRole, Program, Case, Attendance, Notification, DatabaseConfig } from '../types';
import { googleSheetService } from './googleSheetService';
import { supabaseService } from './supabaseService';

class DatabaseService {
  private getStorage<T>(key: string): T[] {
    const data = localStorage.getItem(`resq_${key}`);
    return data ? JSON.parse(data) : [];
  }

  private setStorage<T>(key: string, data: T[]): void {
    localStorage.setItem(`resq_${key}`, JSON.stringify(data));
  }

  // Configuration
  getConfig(): DatabaseConfig {
    const stored = localStorage.getItem('resq_db_config');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Config parse error:", e);
      }
    }
    
    // Default to user provided Supabase config if no storage exists
    const defaultSupabaseUrl = 'https://mwwoharllsaoiqbcbgpz.supabase.co';
    const defaultSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d29oYXJsbHNhb2lxYmNiZ3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjU5NjAsImV4cCI6MjA4ODYwMTk2MH0.2L6rBfZHnLJOIVi39g66vP__xgWoW-PpgH45wLu0a4o';

    return {
      provider: 'supabase',
      googlesheetUrl: localStorage.getItem('resq_gas_url') || undefined,
      supabaseUrl: localStorage.getItem('resq_supabase_url') || defaultSupabaseUrl,
      supabaseKey: localStorage.getItem('resq_supabase_key') || defaultSupabaseKey
    };
  }

  updateConfig(config: DatabaseConfig): void {
    localStorage.setItem('resq_db_config', JSON.stringify(config));
    if (config.googlesheetUrl) localStorage.setItem('resq_gas_url', config.googlesheetUrl);
    if (config.supabaseUrl) localStorage.setItem('resq_supabase_url', config.supabaseUrl);
    if (config.supabaseKey) localStorage.setItem('resq_supabase_key', config.supabaseKey);
  }

  // Cloud Synchronization
  async syncFromCloud(state: string): Promise<void> {
    const config = this.getConfig();
    if (config.provider === 'supabase') {
      try {
        const [cloudUsers, cloudPrograms, cloudCases, cloudAttendance] = await Promise.all([
          supabaseService.getUsers(state),
          supabaseService.getPrograms(state),
          supabaseService.getCases(state),
          supabaseService.getAttendance(state)
        ]);

        if (cloudUsers.length > 0) this.setStorage('users', cloudUsers);
        if (cloudPrograms.length > 0) this.setStorage('programs', cloudPrograms);
        if (cloudCases.length > 0) this.setStorage('cases', cloudCases);
        if (cloudAttendance.length > 0) this.setStorage('attendance', cloudAttendance);
      } catch (err) {
        console.error("Supabase Sync From Cloud Error:", err);
      }
    }
  }

  async syncToCloud(spreadsheetId: string, items: { type: string, payload: any }[]): Promise<boolean> {
    const config = this.getConfig();
    if (config.provider === 'supabase') {
      return await supabaseService.syncData(items);
    } else {
      return await googleSheetService.syncData(spreadsheetId, items);
    }
  }

  private async autoSync(type: string, payload: any): Promise<boolean> {
    try {
      const userStr = localStorage.getItem('resq_user');
      const spreadsheetId = userStr ? JSON.parse(userStr).spreadsheetId : '';
      return await this.syncToCloud(spreadsheetId || '', [{ type, payload }]);
    } catch (err) {
      console.error(`Auto-sync failed for ${type}:`, err);
      return false;
    }
  }

  // Users
  async getUsers(state?: string): Promise<User[]> {
    const users = this.getStorage<User>('users');
    return state ? users.filter(u => u.state === state) : users;
  }

  async addUser(user: User): Promise<boolean> {
    const users = this.getStorage<User>('users');
    if (!users.some(u => u.id === user.id)) {
      users.push(user);
      this.setStorage('users', users);
      return await this.autoSync('users', user);
    }
    return true;
  }

  async updateUser(user: User): Promise<boolean> {
    const users = this.getStorage<User>('users');
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      this.setStorage('users', users);
      return await this.autoSync('users', user);
    }
    return false;
  }

  // Programs
  async getPrograms(state?: string): Promise<Program[]> {
    const programs = this.getStorage<Program>('programs');
    if (!state) return programs;
    return programs.filter(p => p.state === state);
  }

  async addProgram(program: Program): Promise<boolean> {
    const programs = this.getStorage<Program>('programs');
    if (!programs.some(p => p.id === program.id)) {
      programs.push(program);
      this.setStorage('programs', programs);
      return await this.autoSync('programs', program);
    }
    return true;
  }

  async updateProgram(program: Program): Promise<boolean> {
    const programs = this.getStorage<Program>('programs');
    const index = programs.findIndex(p => p.id === program.id);
    if (index !== -1) {
      programs[index] = program;
      this.setStorage('programs', programs);
      return await this.autoSync('programs', program);
    }
    return false;
  }

  // Cases
  async getCases(programId?: string): Promise<Case[]> {
    const cases = this.getStorage<Case>('cases');
    return programId ? cases.filter(c => c.programId === programId) : cases;
  }

  async generateCaseId(): Promise<string> {
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const prefix = `${yy}${mm}${dd}`;
    
    const cases = this.getStorage<Case>('cases');
    const todaysCases = cases.filter(c => c.id.startsWith(prefix));
    
    let maxNum = 0;
    todaysCases.forEach(c => {
      const parts = c.id.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = (maxNum + 1).toString().padStart(3, '0');
    return `${prefix}-${nextNum}`;
  }

  async addCase(newCase: Case): Promise<boolean> {
    const cases = this.getStorage<Case>('cases');
    cases.push(newCase);
    this.setStorage('cases', cases);
    return await this.autoSync('cases', newCase);
  }

  async updateCase(updatedCase: Case): Promise<boolean> {
    const cases = this.getStorage<Case>('cases');
    const index = cases.findIndex(c => c.id === updatedCase.id);
    if (index !== -1) {
      cases[index] = updatedCase;
      this.setStorage('cases', cases);
      return await this.autoSync('cases', updatedCase);
    }
    return false;
  }

  // Attendance
  async getAttendance(programId?: string): Promise<Attendance[]> {
    const attendance = this.getStorage<Attendance>('attendance');
    return programId ? attendance.filter(a => a.programId === programId) : attendance;
  }

  async addAttendance(record: Attendance): Promise<boolean> {
    const attendance = this.getStorage<Attendance>('attendance');
    attendance.push(record);
    this.setStorage('attendance', attendance);
    return await this.autoSync('attendance', record);
  }

  async updateAttendance(record: Attendance): Promise<boolean> {
    const attendance = this.getStorage<Attendance>('attendance');
    const index = attendance.findIndex(a => a.id === record.id);
    if (index !== -1) {
      attendance[index] = record;
      this.setStorage('attendance', attendance);
      return await this.autoSync('attendance', record);
    }
    return false;
  }

  // Notifications
  async getNotifications(programId?: string): Promise<Notification[]> {
    const notifications = this.getStorage<Notification>('notifications');
    return programId ? notifications.filter(n => n.programId === programId) : notifications;
  }

  async addNotification(notification: Notification): Promise<boolean> {
    const notifications = this.getStorage<Notification>('notifications');
    notifications.unshift(notification);
    this.setStorage('notifications', notifications.slice(0, 100));
    return await this.autoSync('notifications', notification);
  }

  /**
   * SEED DEMO DATA
   */
  async seedDemoData(targetState: string = 'Selangor'): Promise<void> {
    localStorage.clear();

    const demoUsers: User[] = [
      { id: 'SA_GLOBAL_001', name: 'Ahmad Root', role: UserRole.SUPERADMIN, state: 'Global', password: 'password', createdAt: new Date().toISOString(), phone: '0123456789' },
      { id: 'MECCHQ', name: 'MECC HQ Admin', role: UserRole.MECC_HQ, state: 'Global', password: '123', createdAt: new Date().toISOString(), phone: '0123456789' },
      { id: 'MECC_SEL_001', name: 'Siti Admin', role: UserRole.MECC, state: 'Selangor', password: 'password', createdAt: new Date().toISOString(), phone: '0111222333' },
      { id: 'MECC_PHG_001', name: 'Zul Admin Pahang', role: UserRole.MECC, state: 'Pahang', password: 'password', createdAt: new Date().toISOString(), phone: '0139988776' },
      { id: 'RES_SEL_999', name: 'Ali Responder', role: UserRole.RESPONDER, state: 'Selangor', createdAt: new Date().toISOString(), phone: '0198877665' },
      { id: 'RES_PHG_888', name: 'Hafiz Pahang', role: UserRole.RESPONDER, state: 'Pahang', createdAt: new Date().toISOString(), phone: '0171122334' },
    ];

    this.setStorage('users', demoUsers);

    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const demoPrograms: Program[] = [
      {
        id: '260501',
        name: 'Larian Amal resQ 2026',
        location: 'Dataran Merdeka',
        date: formattedDate,
        time: '07:00',
        state: 'Selangor',
        level: 'Negeri',
        status: 'Active',
        checkpoints: [
          { id: 'CP1', callsign: 'STATION A (Entry)', location: 'Check-in', pic: 'En. Zul', phone: '01122334455', staff: ['Staff A'] },
          { id: 'CP2', callsign: 'STATION B (Mid)', location: 'Water point', pic: 'Siti', phone: '0111222333', staff: ['Staff B'] }
        ],
        ambulances: [
          { id: 'AMB1', callsign: 'ALPHA 1', noPlate: 'WXY 1234', location: 'Base', pic: 'Dr. Dan', phone: '0191234567', crew: ['Crew 1'] }
        ]
      },
      {
        id: 'PHG_PROG_001',
        name: 'Misi Bantuan resQ Pahang 2026',
        location: 'Kuantan City Center',
        date: formattedDate,
        time: '08:30',
        state: 'Pahang',
        level: 'Negeri',
        status: 'Active',
        checkpoints: [
          { id: 'PHG_CP1', callsign: 'POS KAWALAN KUANTAN', location: 'Kuantan Mall', pic: 'Hafiz', phone: '0171122334', staff: ['Team A'] }
        ],
        ambulances: [
          { id: 'PHG_AMB1', callsign: 'PAHANG ALPHA', noPlate: 'CBH 1122', location: 'Base', pic: 'Dr. Fauzi', phone: '0139988776', crew: ['Crew 1'] }
        ]
      }
    ];

    this.setStorage('programs', demoPrograms);
  }
}

export const db = new DatabaseService();
