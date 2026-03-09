
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ResponderLayout from './components/responder/ResponderLayout';
import MeccLayout from './components/mecc/MeccLayout';
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import TaskCheckIn from './components/responder/TaskCheckIn';
import { User, UserRole, Attendance, Notification } from './types';
import { db } from './services/databaseService';
import { googleSheetService } from './services/googleSheetService';

// Helper function for Malaysian Date Format (DD/MM/YYYY)
export const formatMyDate = (dateInput: string | Date) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput.toString();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// Tactical Time Format (Malaysia 12-hour with AM/PM)
export const formatTacticalTime = (dateInput: string | Date) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput.toString();
  
  const datePart = formatMyDate(d);
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  
  return `${datePart} ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTask, setActiveTask] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Aggressive helper to clear all resQ related local storage
  const clearAllResQData = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('resq_') || key.startsWith('aistudio_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
    } catch (e) {
      console.error("Storage clear error:", e);
      localStorage.clear();
    }
  }, []);

  const recordSession = useCallback(async (userData: User, action: 'LOGIN' | 'LOGOUT', sessionStartTime?: string) => {
    try {
      const timestampUTC = new Date().toISOString();
      const timestampMY = formatTacticalTime(timestampUTC);
      
      let sessionId = localStorage.getItem('resq_current_session_id');
      if (action === 'LOGIN' || !sessionId) {
        sessionId = `SES_${userData.id}_${Date.now()}`;
        localStorage.setItem('resq_current_session_id', sessionId);
      }
      
      const history = JSON.parse(localStorage.getItem('resq_session_logs') || '[]');
      const newEntry = {
        id: sessionId,
        userId: userData.id,
        userName: userData.name,
        role: userData.role,
        action,
        timestamp: timestampMY
      };
      
      localStorage.setItem('resq_session_logs', JSON.stringify([newEntry, ...history].slice(0, 100)));

      // Sync Session to HQ Cloud
      await googleSheetService.syncData(undefined, [{
        type: 'sessions',
        payload: {
          id: sessionId,
          userId: userData.id,
          userName: userData.name,
          role: userData.role,
          action: action,
          entryTime: action === 'LOGIN' ? timestampMY : (sessionStartTime || ''),
          exitTime: action === 'LOGOUT' ? timestampMY : '',
          timestamp: timestampUTC
        }
      }]);
    } catch (e) {
      console.error("Session Sync Error (Non-blocking):", e);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('resq_user');
    const storedTask = localStorage.getItem('resq_active_task');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('resq_user');
      }
    }
    if (storedTask) {
      try {
        setActiveTask(JSON.parse(storedTask));
      } catch (e) {
        localStorage.removeItem('resq_active_task');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    localStorage.setItem('resq_user', JSON.stringify(userData));
    localStorage.setItem('resq_session_start', new Date().toISOString());
    setUser(userData);
    recordSession(userData, 'LOGIN');
  };

  const handleLogout = useCallback(async () => {
    setIsLoading(true);

    if (!user) {
      clearAllResQData();
      setUser(null);
      setActiveTask(null);
      setIsLoading(false);
      navigate('/login', { replace: true });
      return;
    }

    try {
      const sessionStartUTC = localStorage.getItem('resq_session_start') || '';
      const sessionStartMY = sessionStartUTC ? formatTacticalTime(sessionStartUTC) : '';

      // Record logout session
      await recordSession(user, 'LOGOUT', sessionStartMY);

      // If responder + has active task → close it
      if (activeTask) {
        const exitTimeUTC = new Date().toISOString();
        const exitTimeMY = formatTacticalTime(exitTimeUTC);
        const updated = { ...activeTask, exitTime: exitTimeMY, remark: 'COMPLETED' };
        
        await db.updateAttendance(updated);
        await googleSheetService.syncData(user.spreadsheetId, [{
          type: 'attendance',
          payload: {
            id: updated.id,
            responderId: updated.responderId,
            responderName: updated.responderName,
            programName: updated.programName,
            checkpoint: updated.checkpoint,
            entryTime: updated.entryTime,
            exitTime: exitTimeMY, 
            lat: updated.location.lat,
            lng: updated.location.lng,
            remark: 'COMPLETED'
          }
        }]);

        // Notify MECC
        const notification: Notification = {
          id: `NOTIF_${Date.now()}`,
          programId: activeTask.programId,
          senderName: user.name,
          message: `${user.name} TAMAT TUGAS @ ${activeTask.checkpoint} pd ${exitTimeMY}`,
          timestamp: exitTimeUTC,
          type: 'logout'
        };
        await db.addNotification(notification);
      }
    } catch (err) {
      console.error("Logout sync failed (continuing anyway)", err);
    } finally {
      clearAllResQData();
      localStorage.removeItem('resq_session_start');
      localStorage.setItem('resq_logout_success', 'true');
      setUser(null);
      setActiveTask(null);
      setIsLoading(false);
      navigate('/login', { replace: true });
    }
  }, [user, activeTask, navigate, recordSession, clearAllResQData]);

  const handleTaskLogin = (task: Attendance) => {
    setActiveTask(task);
    localStorage.setItem('resq_active_task', JSON.stringify(task));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-500 border-r-4 border-red-500/20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">resQ Protocol: Purging Session...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.role === UserRole.SUPERADMIN ? (
            <SuperAdminLayout user={user} onLogout={handleLogout} />
          ) : user.role === UserRole.RESPONDER ? (
            !activeTask ? <Navigate to="/checkin" replace /> : <ResponderLayout user={user} onLogout={handleLogout} activeTask={activeTask} />
          ) : (
            <MeccLayout user={user} onLogout={handleLogout} />
          )
        }
      />
      <Route 
        path="/checkin"
        element={
          user && user.role === UserRole.RESPONDER ? (
            <TaskCheckIn user={user} onTaskLogin={handleTaskLogin} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
