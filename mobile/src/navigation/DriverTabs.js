import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../theme';

import AttendanceScreen from '../screens/Driver/AttendanceScreen';
import DeliveriesScreen from '../screens/Driver/DeliveriesScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';

const Tab = createBottomTabNavigator();
const Icon = ({ emoji }) => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function DriverTabs() {
    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brandDark, tabBarInactiveTintColor: colors.textMuted }}
        >
            <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarIcon: () => <Icon emoji="🕒" /> }} />
            <Tab.Screen name="Deliveries" component={DeliveriesScreen} options={{ tabBarIcon: () => <Icon emoji="🚚" /> }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: () => <Icon emoji="⚙️" /> }} />
        </Tab.Navigator>
    );
}
