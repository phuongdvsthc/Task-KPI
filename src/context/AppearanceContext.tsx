import React, { createContext, useContext, useEffect, useState } from 'react';
import { systemSettingsService, PublicSettings } from '../services/system-settings.service';
import { useSystemSettings } from './SystemSettingsContext';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type AppearanceAccent = 'indigo' | 'blue' | 'teal';

interface AppearanceContextType {
  mode: AppearanceMode;
  accent: AppearanceAccent;
  resolvedMode: 'light' | 'dark';
  setAppearance: (mode: AppearanceMode, accent: AppearanceAccent) => void;
  isReady: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const STORAGE_MODE_KEY = 'sthc_appearance_mode';
const STORAGE_ACCENT_KEY = 'sthc_appearance_accent';

const VALID_MODES: AppearanceMode[] = ['light', 'dark', 'system'];
const VALID_ACCENTS: AppearanceAccent[] = ['indigo', 'blue', 'teal'];

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemSettingsCtx = useSystemSettings();
  const settings = systemSettingsCtx?.settings;

  const [mode, setModeState] = useState<AppearanceMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved && VALID_MODES.includes(saved as AppearanceMode)) {
      return saved as AppearanceMode;
    }
    return 'light';
  });

  const [accent, setAccentState] = useState<AppearanceAccent>(() => {
    if (typeof window === 'undefined') return 'indigo';
    const saved = localStorage.getItem(STORAGE_ACCENT_KEY);
    if (saved && VALID_ACCENTS.includes(saved as AppearanceAccent)) {
      return saved as AppearanceAccent;
    }
    return 'indigo';
  });

  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');
  const [isReady, setIsReady] = useState(false);

  // Sync with SystemSettingsContext settings if available
  useEffect(() => {
    if (!settings) return;
    const rawMode = settings.appearanceMode || settings.appearance_mode;
    const rawAccent = settings.appearanceAccent || settings.appearance_accent;

    if (rawMode && VALID_MODES.includes(rawMode as AppearanceMode)) {
      setModeState(rawMode as AppearanceMode);
      try {
        localStorage.setItem(STORAGE_MODE_KEY, rawMode);
      } catch {}
    }
    if (rawAccent && VALID_ACCENTS.includes(rawAccent as AppearanceAccent)) {
      setAccentState(rawAccent as AppearanceAccent);
      try {
        localStorage.setItem(STORAGE_ACCENT_KEY, rawAccent);
      } catch {}
    }
    setIsReady(true);
  }, [settings?.appearanceMode, settings?.appearance_mode, settings?.appearanceAccent, settings?.appearance_accent]);

  // Load from public settings API on mount as fallback
  useEffect(() => {
    let isMounted = true;
    systemSettingsService.getPublicSettings().then((pub: any) => {
      if (!isMounted) return;
      const rawMode = pub.appearanceMode || pub.appearance_mode;
      const rawAccent = pub.appearanceAccent || pub.appearance_accent;
      if (rawMode && VALID_MODES.includes(rawMode as AppearanceMode)) {
        setModeState(rawMode as AppearanceMode);
        try {
          localStorage.setItem(STORAGE_MODE_KEY, rawMode);
        } catch {}
      }
      if (rawAccent && VALID_ACCENTS.includes(rawAccent as AppearanceAccent)) {
        setAccentState(rawAccent as AppearanceAccent);
        try {
          localStorage.setItem(STORAGE_ACCENT_KEY, rawAccent);
        } catch {}
      }
      setIsReady(true);
    }).catch(() => {
      if (isMounted) setIsReady(true);
    });
    return () => { isMounted = false; };
  }, []);

  // System mode media query listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolved = () => {
      if (mode === 'system') {
        setResolvedMode(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedMode(mode === 'dark' ? 'dark' : 'light');
      }
    };

    updateResolved();

    const handler = (e: MediaQueryListEvent) => {
      if (mode === 'system') {
        setResolvedMode(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, [mode]);

  // Apply classes and attributes to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(resolvedMode);
    root.setAttribute('data-theme-mode', resolvedMode);
    root.setAttribute('data-theme-accent', accent);
    root.style.colorScheme = resolvedMode;
  }, [resolvedMode, accent]);

  const setAppearance = (newMode: AppearanceMode, newAccent: AppearanceAccent) => {
    const safeMode = VALID_MODES.includes(newMode) ? newMode : 'light';
    const safeAccent = VALID_ACCENTS.includes(newAccent) ? newAccent : 'indigo';

    setModeState(safeMode);
    setAccentState(safeAccent);

    try {
      localStorage.setItem(STORAGE_MODE_KEY, safeMode);
      localStorage.setItem(STORAGE_ACCENT_KEY, safeAccent);
    } catch {
      // fallback
    }

    // Immediately reflect to DOM
    const root = document.documentElement;
    const actualResolved: 'light' | 'dark' = safeMode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (safeMode === 'dark' ? 'dark' : 'light');
    setResolvedMode(actualResolved);
    root.classList.remove('dark', 'light');
    root.classList.add(actualResolved);
    root.setAttribute('data-theme-mode', actualResolved);
    root.setAttribute('data-theme-accent', safeAccent);
    root.style.colorScheme = actualResolved;
  };

  return (
    <AppearanceContext.Provider value={{ mode, accent, resolvedMode, setAppearance, isReady }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
