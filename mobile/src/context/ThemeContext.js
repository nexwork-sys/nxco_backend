import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../theme';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'nxco_theme';

export function ThemeProvider({ children }) {
    const [mode, setMode] = useState('light'); // 'light' | 'dark'
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved === 'dark' || saved === 'light') setMode(saved);
            setReady(true);
        })();
    }, []);

    const toggleTheme = useCallback(() => {
        setMode(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            AsyncStorage.setItem(STORAGE_KEY, next);
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({ mode, isDark: mode === 'dark', colors: mode === 'dark' ? darkColors : lightColors, toggleTheme, ready }),
        [mode, ready, toggleTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
