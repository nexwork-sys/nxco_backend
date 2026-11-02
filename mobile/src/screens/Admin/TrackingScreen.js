import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import AppMap from '../../components/AppMap';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const ROLE_EMOJI = { Driver: '🚚', Marketing: '🛵' };

export default function TrackingScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState([]);
    const [parties, setParties] = useState([]);
    const mapRef = useRef(null);
    const pollRef = useRef(null);

    const loadActive = useCallback(async () => {
        const res = await api.get('/tracking/live');
        setActive(res.data.active_employees || []);
    }, []);

    const loadParties = useCallback(async () => {
        const res = await api.get('/parties');
        setParties(res.data.parties || []);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadActive();
            loadParties();
            pollRef.current = setInterval(loadActive, 10000);
            return () => clearInterval(pollRef.current);
        }, [loadActive, loadParties])
    );

    const markers = useMemo(() => [
        ...parties
            .filter(p => p.lat && p.lng)
            .map(p => ({ id: `party-${p.id}`, latitude: p.lat, longitude: p.lng, label: p.party_name, color: '#0ea5e9' })),
        ...active
            .filter(a => a.lat && a.lng)
            .map(a => ({ id: `staff-${a.id}`, latitude: a.lat, longitude: a.lng, label: `${ROLE_EMOJI[a.role] || ''} ${a.name}`.trim(), color: colors.brand })),
    ], [parties, active, colors.brand]);

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Live Tracking" />
            <AppMap
                mapRef={mapRef}
                style={{ flex: 1 }}
                initialRegion={{ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 15, longitudeDelta: 15 }}
                markers={markers}
            />
            <View style={styles.legend}>
                <Text style={styles.legendText}>{active.length} checked in right now</Text>
            </View>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    pin: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
    },
    legend: {
        position: 'absolute', bottom: spacing.lg, alignSelf: 'center',
        backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    legendText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
});
