import React from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import AdminTargetsScreen from '../Admin/TargetsScreen';

// Manager gets the same Targets screen Admin uses — set/view each
// Marketing employee's monthly target and live progress. Reused as-is,
// just under this dashboard's own header, since Operations' tab
// navigator has no native stack header (unlike Admin's "More" stack).
export default function TargetsScreen() {
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Marketing Targets" />
            <AdminTargetsScreen />
        </View>
    );
}
