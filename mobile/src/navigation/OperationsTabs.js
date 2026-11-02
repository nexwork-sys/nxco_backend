import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';

import AttendanceScreen from '../screens/Supervisor/AttendanceScreen';
import InventoryScreen from '../screens/Supervisor/InventoryScreen';
import OrdersScreen from '../screens/Supervisor/OrdersScreen';
import PartyDashboardScreen from '../screens/Supervisor/PartyDashboardScreen';
import PartiesScreen from '../screens/Supervisor/PartiesScreen';
import PJPScreen from '../screens/Supervisor/PJPScreen';
import TargetsScreen from '../screens/Supervisor/TargetsScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';

const Tab = createBottomTabNavigator();
const Icon = ({ emoji }) => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function OperationsTabs() {
    const { user } = useAuth();
    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brandDark, tabBarInactiveTintColor: colors.textMuted }}
        >
            <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarIcon: () => <Icon emoji="🕒" /> }} />
            <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarIcon: () => <Icon emoji="📦" /> }} />
            <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Incoming Orders', tabBarIcon: () => <Icon emoji="🧾" /> }} />
            <Tab.Screen name="PartyDashboard" component={PartyDashboardScreen} options={{ title: 'Party Dashboard', tabBarIcon: () => <Icon emoji="📍" /> }} />
            {/* Approving/rejecting parties and filling in their rate form is
                Admin/Manager only on the backend — only show these tabs for
                Manager here so Supervisor/Operator don't hit a confusing
                permission error. */}
            {user?.role === 'Manager' && (
                <Tab.Screen name="Parties" component={PartiesScreen} options={{ title: 'Manage Parties', tabBarIcon: () => <Icon emoji="🏬" /> }} />
            )}
            {user?.role === 'Manager' && (
                <Tab.Screen name="PJP" component={PJPScreen} options={{ title: 'Plan Visits', tabBarIcon: () => <Icon emoji="🗓️" /> }} />
            )}
            {user?.role === 'Manager' && (
                <Tab.Screen name="Targets" component={TargetsScreen} options={{ title: 'Targets', tabBarIcon: () => <Icon emoji="🎯" /> }} />
            )}
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: () => <Icon emoji="⚙️" /> }} />
        </Tab.Navigator>
    );
}
