import React from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import AdminPartyDashboardScreen from '../Admin/PartyDashboardScreen';

// Manager/Supervisor/Operator see the same Area -> Parties -> Detail
// dashboard Admin uses — reuse as-is, just under this dashboard's own
// header, since Operations' tab navigator has no native stack header.
export default function PartyDashboardScreen() {
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Party Dashboard" />
            <AdminPartyDashboardScreen />
        </View>
    );
}
