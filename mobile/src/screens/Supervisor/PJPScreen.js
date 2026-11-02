import React from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import SharedPJPScreen from '../Shared/PJPScreen';

// Manager builds Marketing employees' journey plans (same screen Admin
// uses) — reuse as-is, just under this dashboard's own header, since
// Operations' tab navigator has no native stack header.
export default function PJPScreen() {
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Plan Visits (PJP)" />
            <SharedPJPScreen />
        </View>
    );
}
