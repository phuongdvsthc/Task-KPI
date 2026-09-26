import React, { createContext, useContext, useState, useEffect } from 'react';
import { systemSettingsService, PublicSettings } from '../services/system-settings.service';

interface SystemSettingsContextType {
  settings: PublicSettings | null;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const data = await systemSettingsService.getPublicSettings();
      setSettings(data);
      setError(null);
    } catch (err: any) {
      console.error('Lỗi tải cấu hình:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    if (settings?.faviconPath) {
      const url = systemSettingsService.getSystemAssetPublicUrl(settings.faviconPath);
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    }
  }, [settings?.faviconPath]);

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <SystemSettingsContext.Provider value={{ settings, loading, error, refreshSettings: loadSettings }}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (context === undefined) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
};
