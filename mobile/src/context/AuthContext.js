import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

const AuthContext = createContext(null);

// Which role sees which navigator — Supervisor/Manager/Operator share one
// "Operations" experience, same as the original web dashboards.
export function roleGroup(role) {
    if (role === 'Admin') return 'Admin';
    if (role === 'Marketing') return 'Marketing';
    if (['Supervisor', 'Manager', 'Operator'].includes(role)) return 'Operations';
    if (role === 'Driver') return 'Driver';
    return null;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [booting, setBooting] = useState(true);

    // On app launch, validate any stored token instead of trusting it blindly
    // — mirrors the web app's guardRole() calling /api/auth/me first.
    //
    // The auth check above can resolve almost instantly (no token → return
    // immediately), which was flipping `booting` to false before the
    // splash screen's fade/scale-in animation (~800ms, matching the web
    // app's load motion) had any chance to play — the app jumped straight
    // to the login screen with no visible "motion" at all. Enforcing a
    // minimum splash time guarantees the animation always gets to finish.
    useEffect(() => {
        const MIN_SPLASH_MS = 1200;
        (async () => {
            const started = Date.now();
            const token = await AsyncStorage.getItem('nxco_token');
            let loggedInUser = null;
            if (token) {
                const res = await api.get('/auth/me');
                if (res.data?.success) loggedInUser = res.data.user;
                else await AsyncStorage.removeItem('nxco_token');
            }
            const elapsed = Date.now() - started;
            if (elapsed < MIN_SPLASH_MS) {
                await new Promise(r => setTimeout(r, MIN_SPLASH_MS - elapsed));
            }
            if (loggedInUser) setUser(loggedInUser);
            setBooting(false);
        })();
    }, []);

    const login = useCallback(async (employee_id, password) => {
        const res = await api.post('/auth/login', { employee_id, password });
        if (res.data?.success) {
            await AsyncStorage.setItem('nxco_token', res.data.token);
            setUser(res.data.user);
        }
        return res.data;
    }, []);

    const logout = useCallback(async () => {
        await AsyncStorage.removeItem('nxco_token');
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, booting, login, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
