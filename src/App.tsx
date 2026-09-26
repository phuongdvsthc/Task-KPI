import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthorizationProvider } from './context/AuthorizationContext';
import { SystemSettingsProvider } from './context/SystemSettingsContext';
import { AppearanceProvider } from './context/AppearanceContext';
import { NotificationProvider } from './context/NotificationContext';
import { LoginView } from './components/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { GraduationCap, Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Đang khởi động hệ thống quản trị...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <AppLayout />;
};

export default function App() {
  return (
    <SystemSettingsProvider>
      <AppearanceProvider>
        <AuthProvider>
          <AuthorizationProvider>
            <NotificationProvider>
              <MainContent />
            </NotificationProvider>
          </AuthorizationProvider>
        </AuthProvider>
      </AppearanceProvider>
    </SystemSettingsProvider>
  );
}
