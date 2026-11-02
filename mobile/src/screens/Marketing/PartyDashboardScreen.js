import React from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import AdminPartyDashboardScreen from '../Admin/PartyDashboardScreen';

// Marketing sees the same Area -> Parties -> Detail dashboard Admin uses
// (same read-only /api/parties data, backend already allows any logged-in
// role) — reuse the screen as-is, just under this dashboard's own header,
// since Marketing's tab navigator has no native stack header like Admin's
// "More" stack does.
export default function PartyDashboardScreen() {
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Party Dashboard" />
            <AdminPartyDashboardScreen />
        </View>
    );
}
