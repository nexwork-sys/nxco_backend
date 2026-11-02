import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, SectionTitle, EmptyState, Loading } from '../../components/ui';
import { toast } from '../../components/Toast';
import { getAccurateLocation } from '../../utils/location';
import { todayIST } from '../../utils/format';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function AttendanceScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [parties, setParties] = useState([]);
    const [selectedParty, setSelectedParty] = useState(null);
    const [records, setRecords] = useState([]);
    const [target, setTarget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [working, setWorking] = useState(false);
    const pingRef = useRef(null);

    // Only today's own record on this first tab — current status at a
    // glance, not the whole history of past days.
    const load = useCallback(async () => {
        const [partiesRes, attRes, targetRes] = await Promise.all([
            api.get('/parties'),
            api.get('/attendance/list', { params: { date: todayIST() } }),
            api.get('/targets/mine'),
        ]);
        setParties(partiesRes.data.parties || []);
        setRecords(attRes.data.attendance || []);
        setTarget(targetRes.data.target || null);
        setLoading(false);
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
        if (type === 'in' && !selectedParty) {
            toast('Select the party you are visiting first.', 'error');
            return;
        }
        setWorking(true);
        setStatus('Getting your location…');
        try {
            const loc = await getAccurateLocation();
            const res = await api.post('/attendance/mark', { type, lat: loc.lat, lng: loc.lng, party_id: selectedParty?.id });
            setStatus(res.data.message);
            if (res.data.success) {
                toast(res.data.message);
                if (type === 'in') startLocationPing();
                if (type === 'out') stopLocationPing();
                load();
            } else {
                toast(res.data.message, 'error');
            }
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
                {!loading && target && (
                    <Card>
                        <SectionTitle>My Target — {target.month}</SectionTitle>
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${target.percent}%`, backgroundColor: target.completed ? '#2e7d32' : colors.brand },
                                ]}
                            />
                        </View>
                        <Text style={styles.hint}>
                            {target.achieved} / {target.quantity_target} done · {target.remaining} pending
                        </Text>
                        <Text style={[styles.hint, target.days_left <= 3 && { color: colors.danger, fontWeight: '700' }]}>
                            {target.days_left >= 0 ? `${target.days_left} day(s) left` : 'Deadline passed'} · complete by {target.end_date}
                        </Text>
                    </Card>
                )}

                <Card>
                    <SectionTitle>Mark Attendance</SectionTitle>
                    <Text style={styles.hint}>
                        Select the party you're visiting and be within 1000m of its shop to check in. New shop? Add it under "Add Party" first — it'll then appear here.
                    </Text>
                    <Text style={styles.label}>Select the Party You're Visiting</Text>
                    {loading ? (
                        <Loading />
                    ) : parties.length === 0 ? (
                        <EmptyState text="No parties yet — add one first." />
                    ) : (
                        <View style={styles.partyList}>
                            {parties.map(p => (
                                <Pressable
                                    key={p.id}
                                    onPress={() => setSelectedParty(p)}
                                    style={[styles.partyChip, selectedParty?.id === p.id && styles.partyChipActive]}
                                >
                                    <Text style={[styles.partyChipText, selectedParty?.id === p.id && styles.partyChipTextActive]}>
                                        {p.party_name} ({p.area})
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

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
                            {a.party_name && <Text style={styles.hint}>Visited: {a.party_name}</Text>}
                        </Card>
                    ))
                )}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    hint: { color: colors.textMuted, fontSize: 12.5, marginBottom: spacing.md },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: '100%', borderRadius: 4 },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
    partyList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    partyChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    partyChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    partyChipText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
    partyChipTextActive: { color: '#fff' },
    btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    status: { marginTop: spacing.md, color: colors.textMuted, fontSize: 12.5 },
    title: { fontWeight: '700', color: colors.text },
});
