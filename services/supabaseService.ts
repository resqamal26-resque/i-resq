
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Program, Case, Attendance } from '../types';

class SupabaseService {
  private client: SupabaseClient | null = null;

  private getConfig() {
    return {
      url: localStorage.getItem('resq_supabase_url') || '',
      key: localStorage.getItem('resq_supabase_key') || ''
    };
  }

  private getClient(): SupabaseClient | null {
    if (this.client) return this.client;
    const { url, key } = this.getConfig();
    if (!url || !key) return null;
    this.client = createClient(url, key);
    return this.client;
  }

  async testConnection(): Promise<{ status: 'success' | 'error'; message?: string }> {
    const client = this.getClient();
    if (!client) return { status: 'error', message: 'Supabase URL atau Key tidak ditetapkan.' };

    try {
      const { error } = await client.from('users').select('id').limit(1);
      if (error) throw error;
      return { status: 'success' };
    } catch (err: any) {
      console.error("Supabase Connection Test Error:", err);
      return { status: 'error', message: err.message || 'Gagal menghubungi Supabase.' };
    }
  }

  async syncData(items: { type: string, payload: any }[]): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      for (const item of items) {
        const { type, payload } = item;
        
        // Map types to Supabase tables
        let table = '';
        if (type === 'users') table = 'users';
        else if (type === 'cases') table = 'cases';
        else if (type === 'attendance') table = 'attendance';
        else if (type === 'programs') table = 'programs';
        else if (type === 'sessions') table = 'sessions';
        else if (type === 'notifications') table = 'notifications';
        else continue;

        // Handle nested objects for Supabase (e.g., location in attendance)
        const dataToSync = { ...payload };
        if (table === 'attendance' && dataToSync.location) {
          dataToSync.lat = dataToSync.location.lat;
          dataToSync.lng = dataToSync.location.lng;
          delete dataToSync.location;
        }

        const { error } = await client
          .from(table)
          .upsert(dataToSync, { onConflict: 'id' });

        if (error) throw error;
      }
      return true;
    } catch (err) {
      console.error("Supabase Sync Error:", err);
      return false;
    }
  }

  // Fetching methods
  async getUsers(state?: string): Promise<User[]> {
    const client = this.getClient();
    if (!client) return [];
    let query = client.from('users').select('*');
    if (state && state !== 'Global') {
      query = query.eq('state', state);
    }
    const { data, error } = await query;
    return error ? [] : data as User[];
  }

  async getPrograms(state?: string): Promise<Program[]> {
    const client = this.getClient();
    if (!client) return [];
    let query = client.from('programs').select('*');
    if (state && state !== 'Global') {
      query = query.eq('state', state);
    }
    const { data, error } = await query;
    return error ? [] : data as Program[];
  }

  async getCases(state?: string): Promise<Case[]> {
    const client = this.getClient();
    if (!client) return [];
    let query = client.from('cases').select('*');
    if (state && state !== 'Global') {
      query = query.eq('state', state);
    }
    const { data, error } = await query;
    return error ? [] : data as Case[];
  }

  async getAttendance(state?: string): Promise<Attendance[]> {
    const client = this.getClient();
    if (!client) return [];
    let query = client.from('attendance').select('*');
    if (state && state !== 'Global') {
      query = query.eq('state', state);
    }
    const { data, error } = await query;
    // Map back lat/lng to location object if needed
    return error ? [] : (data as any[]).map(item => ({
      ...item,
      location: { lat: item.lat, lng: item.lng }
    })) as Attendance[];
  }

  // Placeholder methods for Supabase operations
  // In a real app, we'd implement full CRUD here
}

export const supabaseService = new SupabaseService();
