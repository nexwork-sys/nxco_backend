import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, SectionTitle, EmptyState } from '../../components/ui';
import { toast } from '../../components/Toast';
import { getAccurateLocation } from '../../utils/location';
import { todayIST } from '../../utils/format';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function AttendanceScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [records, setRecords] = useState([]);
    const [status, setStatus] = useState('');
    const [working, setWorking] = useState(false);
    const pingRef = useRef(null);

    // Only today's own record — this is the Manager's first tab, so it
    // should show current/today's status at a glance, not the full
    // check-in history piling up from previous days.
    const load = useCallback(async () => {
        const res = await api.get('/attendance/list', { params: { date: todayIST() } });
        setRecords(res.data.attendance || []);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Shares live location with Admin's tracking map every 15s while
    // checked in — same pattern as Driver's attendance screen.
    function startLocationPing() {
        if (pingRef.current) return;
        pingRef.current = setInterval(async () => {
            try {
                const loc = await getAccurateLocation({ timeoutMs: 6000, desiredAccuracyM: 50 });
                api.post('/tracking/ping', { lat: loc.lat, lng: loc.lng });
            } catch { /* transient GPS miss — try again next tick */ }
        }, 15000);
    }
    function stopLocationPing() {
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    }

    async function mark(type) {
        if (working) return; // re-entrancy guard against double-tap
        setWorking(true);
        setStatus('Getting your location…');
        try {
            const loc = await getAccurateLocation();
            const res = await api.post('/attendance/mark', { type, lat: loc.lat, lng: loc.lng });
            setStatus(res.data.message);
            if (res.data.success) {
                toast(res.data.message);
                if (type === 'in') startLocationPing();
                if (type === 'out') stopLocationPing();
                load();
            }
            else toast(res.data.message, 'error');
        } catch (e) {
            setStatus(e.message);
            toast(e.message, 'error');
        } finally {
            setWorking(false);
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Attendance" />
            <Screen>
                <Card>
                    <SectionTitle>Mark Attendance</SectionTitle>
                    <Text style={styles.hint}>Attendance is accepted only within the office's allowed radius.</Text>
                    <View style={styles.btnRow}>
                        <Button title="✅ Check In" onPress={() => mark('in')} loading={working} style={{ flex: 1 }} />
                        <Button title="🚪 Check Out" variant="outline" onPress={() => mark('out')} loading={working} style={{ flex: 1 }} />
                    </View>
                    {status ? <Text style={styles.status}>{status}</Text> : null}
                </Card>

                <SectionTitle>Today's Attendance</SectionTitle>
                {records.length === 0 ? (
                    <EmptyState text="Not checked in today yet." />
                ) : (
                    records.map(a => (
                        <Card key={a.id}>
                            <Text style={styles.title}>{a.date}</Text>
                            <Text style={styles.hint}>In {a.time_in ?? '—'} · Out {a.time_out ?? '—'}</Text>
                        </Card>
                    ))
                )}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    hint: { color: colors.textMuted, fontSize: 12.5, marginBottom: spacing.md },
    btnRow: { flexDirection: 'row', gap: spacing.md },
    status: { marginTop: spacing.md, color: colors.textMuted, fontSize: 12.5 },
    title: { fontWeight: '700', color: colors.text },
});
