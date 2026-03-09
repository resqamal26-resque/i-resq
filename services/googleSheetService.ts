
import { User, Program } from '../types';

class GoogleSheetService {
  private defaultGasUrl = 'https://script.google.com/macros/s/AKfycbx1HIDERXBiz9A7D8hL7MaYNCgZqQqqzwqpWuyzwzXCvNkDuRvd0LWfvATfUWzLXB_1nA/exec';

  private getAppScriptUrl(): string {
    return localStorage.getItem('resq_gas_url') || this.defaultGasUrl;
  }

  async testConnection(): Promise<{ status: string; structure?: any; message?: string }> {
    const url = this.getAppScriptUrl();
    if (!url) return { status: 'error', message: 'URL tidak ditetapkan.' };

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'test_connection'
        })
      });
      return await response.json();
    } catch (err) {
      console.error("Connection Test Error:", err);
      return { status: 'error', message: 'Gagal menghubungi Web App.' };
    }
  }

  async checkUserById(id: string): Promise<{ status: 'success' | 'error'; user?: User; message?: string }> {
    const url = this.getAppScriptUrl();
    if (!url) return { status: 'error', message: 'Backend URL missing.' };

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'check_id',
          id: id
        })
      });
      return await response.json();
    } catch (err) {
      console.error("ID Check Error:", err);
      return { status: 'error', message: 'Gagal menghubungi pangkalan data Master.' };
    }
  }

  async fetchProgramsByState(state: string): Promise<Program[]> {
    const url = this.getAppScriptUrl();
    if (!url) return [];

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'get_programs_by_state',
          state: state
        })
      });
      const result = await response.json();
      return result.status === 'success' ? result.programs : [];
    } catch (err) {
      console.error("Fetch Programs Error:", err);
      return [];
    }
  }

  async registerUser(user: User): Promise<string> {
    const url = this.getAppScriptUrl();
    if (!url) return '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          data: user
        })
      });
      const result = await response.json();
      return result.spreadsheetId || '';
    } catch (err) {
      console.error("Sheet Registration Error:", err);
      return '';
    }
  }

  /**
   * Syncs data to Google Sheets with a safety timeout. 
   */
  async syncData(spreadsheetId: string | undefined, items: { type: string, payload: any }[]): Promise<boolean> {
    const url = this.getAppScriptUrl();
    if (!url) return false;

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased to 8s for reliability

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          action: 'sync',
          spreadsheetId: spreadsheetId || "", 
          data: items
        })
      });
      clearTimeout(timeoutId);
      const result = await response.json();
      return result.status === 'success';
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Sheet Sync Error:", err);
      return false;
    }
  }
}

export const googleSheetService = new GoogleSheetService();
