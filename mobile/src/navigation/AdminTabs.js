import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme';

import OverviewScreen from '../screens/Admin/OverviewScreen';
import OrdersScreen from '../screens/Admin/OrdersScreen';
import TrackingScreen from '../screens/Admin/TrackingScreen';
import PartiesScreen from '../screens/Admin/PartiesScreen';
import MoreScreen from '../screens/Admin/MoreScreen';
import EmployeesScreen from '../screens/Admin/EmployeesScreen';
import ProductsScreen from '../screens/Admin/ProductsScreen';
import PartyDashboardScreen from '../screens/Admin/PartyDashboardScreen';
import PJPScreen from '../screens/Shared/PJPScreen';
import AttendanceScreen from '../screens/Admin/AttendanceScreen';
import SettingsScreen from '../screens/Admin/SettingsScreen';
import TargetsScreen from '../screens/Admin/TargetsScreen';

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

function Icon({ emoji }) {
    return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

// "More" is its own mini-stack so secondary Admin sections (Employees,
// Products, Party Dashboard, Attendance, Settings) push on top of the menu
// instead of needing 9 crowded bottom tabs.
function MoreStackNavigator() {
    return (
        <MoreStack.Navigator screenOptions={{ headerShown: true, headerTintColor: colors.text }}>
            <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ title: 'More' }} />
            <MoreStack.Screen name="Employees" component={EmployeesScreen} />
            <MoreStack.Screen name="Products" component={ProductsScreen} options={{ title: 'Product Inventory' }} />
            <MoreStack.Screen name="PartyDashboard" component={PartyDashboardScreen} options={{ title: 'Party Dashboard' }} />
            <MoreStack.Screen name="PJP" component={PJPScreen} options={{ title: 'Plan Visits (PJP)' }} />
            <MoreStack.Screen name="Targets" component={TargetsScreen} options={{ title: 'Marketing Targets' }} />
            <MoreStack.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Attendance' }} />
            <MoreStack.Screen name="Settings" component={SettingsScreen} />
        </MoreStack.Navigator>
    );
}

export default function AdminTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.brandDark,
                tabBarInactiveTintColor: colors.textMuted,
            }}
        >
            <Tab.Screen name="Overview" component={OverviewScreen} options={{ tabBarIcon: () => <Icon emoji="📊" /> }} />
            <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: () => <Icon emoji="🧾" /> }} />
            <Tab.Screen name="Tracking" component={TrackingScreen} options={{ tabBarIcon: () => <Icon emoji="📍" /> }} />
            <Tab.Screen name="Parties" component={PartiesScreen} options={{ tabBarIcon: () => <Icon emoji="🏬" /> }} />
            <Tab.Screen name="More" component={MoreStackNavigator} options={{ tabBarIcon: () => <Icon emoji="☰" /> }} />
        </Tab.Navigator>
    );
}
