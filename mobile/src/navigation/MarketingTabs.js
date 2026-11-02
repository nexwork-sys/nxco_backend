import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../theme';

import AttendanceScreen from '../screens/Marketing/AttendanceScreen';
import AddPartyScreen from '../screens/Marketing/AddPartyScreen';
import PlaceOrderScreen from '../screens/Marketing/PlaceOrderScreen';
import MyOrdersScreen from '../screens/Marketing/MyOrdersScreen';
import PartyDashboardScreen from '../screens/Marketing/PartyDashboardScreen';
import MyPlanScreen from '../screens/Marketing/MyPlanScreen';
import SettingsScreen from '../screens/Shared/SettingsScreen';

const Tab = createBottomTabNavigator();
const Icon = ({ emoji }) => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function MarketingTabs() {
    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brandDark, tabBarInactiveTintColor: colors.textMuted }}
        >
            <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarIcon: () => <Icon emoji="🕒" /> }} />
            <Tab.Screen name="AddParty" component={AddPartyScreen} options={{ title: 'Add Party', tabBarIcon: () => <Icon emoji="🏬" /> }} />
            <Tab.Screen name="PartyDashboard" component={PartyDashboardScreen} options={{ title: 'Parties', tabBarIcon: () => <Icon emoji="📍" /> }} />
            <Tab.Screen name="MyPlan" component={MyPlanScreen} options={{ title: 'My Plan', tabBarIcon: () => <Icon emoji="🗓️" /> }} />
            <Tab.Screen name="PlaceOrder" component={PlaceOrderScreen} options={{ title: 'Place Order', tabBarIcon: () => <Icon emoji="🛒" /> }} />
            <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'My Orders', tabBarIcon: () => <Icon emoji="🧾" /> }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: () => <Icon emoji="⚙️" /> }} />
        </Tab.Navigator>
    );
}
