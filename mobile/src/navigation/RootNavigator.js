import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth, roleGroup } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SplashScreen from '../components/SplashScreen';

import LoginScreen from '../screens/Auth/LoginScreen';
import AdminTabs from './AdminTabs';
import MarketingTabs from './MarketingTabs';
import OperationsTabs from './OperationsTabs';
import DriverTabs from './DriverTabs';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { user, booting } = useAuth();
    const { colors, isDark } = useTheme();

    if (booting) {
        return <SplashScreen />;
    }

    const group = user ? roleGroup(user.role) : null;

    // Feed our own brand palette into React Navigation's theme so screen
    // backgrounds / status-bar area behind the stack match light/dark mode
    // instead of the library's hardcoded defaults.
    const navTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            background: colors.bg,
            card: colors.surface,
            border: colors.border,
            text: colors.text,
            primary: colors.brand,
        },
    };

    return (
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user || !group ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : group === 'Admin' ? (
                    <Stack.Screen name="AdminHome" component={AdminTabs} />
                ) : group === 'Marketing' ? (
                    <Stack.Screen name="MarketingHome" component={MarketingTabs} />
                ) : group === 'Operations' ? (
                    <Stack.Screen name="OperationsHome" component={OperationsTabs} />
                ) : (
                    <Stack.Screen name="DriverHome" component={DriverTabs} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
