import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getSettings, saveSettings, fetchSettingsFromApi } from '../utils/storage';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [settings, setSettingsState] = useState(() => getSettings());
    const [settingsVersion, setSettingsVersion] = useState(0);

    // Global settings update function — bumps version so consumers can react
    const updateSettings = useCallback((newSettings) => {
        saveSettings(newSettings);
        setSettingsState(newSettings);
        setSettingsVersion(v => v + 1);
    }, []);

    // Reload settings from storage
    const reloadSettings = useCallback(() => {
        const freshSettings = getSettings();
        setSettingsState(freshSettings);
        setSettingsVersion(v => v + 1);
    }, []);

    // Sync with Server (API)
    useEffect(() => {
        const syncWithServer = async () => {
            try {
                const remoteSettings = await fetchSettingsFromApi();
                if (remoteSettings) {
                    const currentSettings = getSettings();

                    // Logic: If remote has a timestamp and it's newer than local, OR if local has no timestamp
                    // We treat server as authority for sync
                    const remoteTime = remoteSettings.lastUpdated || 0;
                    const localTime = currentSettings.lastUpdated || 0;

                    if (remoteTime > localTime) {
                        console.log('[Settings] Syncing from server (Remote is newer)...');
                        // Update local storage directly to avoid triggering a save-loop
                        localStorage.setItem('dailyEventAI_settings', JSON.stringify(remoteSettings));
                        reloadSettings();
                    }
                    // Fallback for initial load if keys are missing (e.g. strict checks)
                    else if (!currentSettings.upAhead?.keywords?.shopping) {
                         console.log('[Settings] Patching missing keywords from remote...');
                         // Merge missing keys
                         const merged = { ...remoteSettings, ...currentSettings, upAhead: { ...remoteSettings.upAhead, ...currentSettings.upAhead } };
                         // But ensure deep structures like keywords are present
                         if (!merged.upAhead.keywords) merged.upAhead.keywords = remoteSettings.upAhead.keywords;

                         localStorage.setItem('dailyEventAI_settings', JSON.stringify(merged));
                         reloadSettings();
                    }
                }
            } catch (err) {
                console.warn('[Settings] Failed to sync with server', err);
            }
        };

        syncWithServer();
    }, [reloadSettings]);

    // Listen for storage changes from other tabs
    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'dailyEventAI_settings') {
                console.log('[SettingsContext] Storage changed in another tab, reloading');
                reloadSettings();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [reloadSettings]);

    // Apply font size globally
    useEffect(() => {
        if (settings.fontSize) {
            document.documentElement.style.fontSize = settings.fontSize + 'px';
        }
    }, [settings.fontSize]);

    // Apply Theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
    }, [settings.theme]);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, reloadSettings, settingsVersion }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
}
