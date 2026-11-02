import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import ToastHost from './src/components/Toast';

/**
 * True root of the app. This file is what Expo's AppEntry.js actually
 * mounts — it MUST default-export a React component. (It previously
 * exported a stray copy of the axios client instead of a component,
 * which crashed the app instantly on open since there was nothing valid
 * to render — and meant none of the providers/SplashScreen below ever
 * mounted either.)
 */
function ThemedStatusBar() {
    const { isDark } = useTheme();
    return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <ThemedStatusBar />
                    <RootNavigator />
                    <ToastHost />
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
