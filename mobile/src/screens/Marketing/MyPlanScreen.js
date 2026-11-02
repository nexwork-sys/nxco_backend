import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Badge, Field, EmptyState, Loading, SectionTitle } from '../../components/ui';
import FormModal from '../../components/FormModal';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { todayIST } from '../../utils/format';

// Today's PJP (journey plan) assigned by Admin/Manager: which parties to
// visit today. Tapping "Revisit" on a party logs what happened — that
// becomes the party's new Last Visit everywhere, and flips this card to
// Visited. Below that, a Plan History panel lets the employee check any
// past date's plan too — same completed/pending view Admin/Manager get.
export default function MyPlanScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [parties, setParties] = useState([]);
    const [target, setTarget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [revisitParty, setRevisitParty] = useState(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [historyDate, setHistoryDate] = useState(todayIST());
    const [historyPlan, setHistoryPlan] = useState(null); // { planned_count, visited_count, pending_count, parties }
    const [historyLoading, setHistoryLoading] = useState(true);

    const loadHistory = useCallback(async (date) => {
        setHistoryLoading(true);
        const res = await api.get('/pjp/status', { params: { date } });
        setHistoryPlan((res.data.plans || [])[0] || null); // Marketing only ever gets their own plan back
        setHistoryLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { loadHistory(historyDate); }, [loadHistory, historyDate]));

    function shiftHistoryDate(days) {
        const d = new Date(`${historyDate}T00:00:00`);
        d.setDate(d.getDate() + days);
        setHistoryDate(d.toISOString().slice(0, 10));
    }

    const load = useCallback(async () => {
        const [pjpRes, targetRes] = await Promise.all([
            api.get('/pjp/today'),
            api.get('/targets/mine'),
        ]);
        setParties(pjpRes.data.parties || []);
        setTarget(targetRes.data.target || null);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await Promise.all([load(), loadHistory(historyDate)]);
        setRefreshing(false);
    }

    function openRevisit(p) {
        setRevisitParty(p);
        setNote('');
    }

    async function submitRevisit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!note.trim()) {
            toast('Enter what happened on this visit.', 'error');
            return;
        }
        setSubmitting(true);
        const res = await api.post('/visits', { party_id: revisitParty.id, note: note.trim() });
        setSubmitting(false);
        if (res.data.success) {
            toast('Visit logged.');
            setRevisitParty(null);
            load();
        } else {
            toast(res.data.message || 'Could not log visit.', 'error');
        }
    }

    const pendingCount = parties.filter(p => !p.visited_today).length;

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="My Plan (PJP)" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
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
                        <Text style={styles.muted}>
                            {target.achieved} / {target.quantity_target} done · {target.remaining} pending
                        </Text>
                        <Text style={[styles.muted, target.days_left <= 3 && { color: colors.danger, fontWeight: '700' }]}>
                            {target.days_left >= 0 ? `${target.days_left} day(s) left` : 'Deadline passed'} · complete by {target.end_date}
                        </Text>
                    </Card>
                )}

                <Text style={styles.hint}>
                    Parties your Admin/Manager assigned for today. Tap "📝 Revisit" after visiting one to log what happened.
                </Text>
                {loading ? (
                    <Loading />
                ) : parties.length === 0 ? (
                    <EmptyState text="No plan assigned for today yet." />
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>{pendingCount} of {parties.length} pending</Text>
                        {parties.map(p => (
                            <Card key={p.id}>
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.title}>{p.party_name}</Text>
                                        <Text style={styles.muted}>{p.owner_name} · {p.mobile}</Text>
                                        <Text style={styles.muted}>{p.area}, {p.city}</Text>
                                    </View>
                                    <Badge status={p.visited_today ? 'Visited' : 'Pending'} />
                                </View>
                                <Pressable onPress={() => openRevisit(p)} style={styles.revisitBtn}>
                                    <Text style={styles.revisitBtnText}>📝 Revisit — Log What Happened</Text>
                                </Pressable>
                            </Card>
                        ))}
                    </>
                )}

                <Card style={{ marginTop: spacing.lg }}>
                    <SectionTitle>Plan History</SectionTitle>
                    <Text style={styles.hint}>Check any date — completed vs pending, same view Admin/Manager see.</Text>
                    <View style={styles.dateNavRow}>
                        <Pressable onPress={() => shiftHistoryDate(-1)} style={styles.dateNavBtn}>
                            <Text style={styles.dateNavBtnText}>‹ Prev</Text>
                        </Pressable>
                        <Text style={styles.dateLabel}>{historyDate}{historyDate === todayIST() ? ' (Today)' : ''}</Text>
                        <Pressable onPress={() => shiftHistoryDate(1)} style={styles.dateNavBtn}>
                            <Text style={styles.dateNavBtnText}>Next ›</Text>
                        </Pressable>
                    </View>

                    {historyLoading ? (
                        <Loading />
                    ) : !historyPlan ? (
                        <EmptyState text="No plan was set for this date." />
                    ) : (
                        <>
                            <Text style={styles.summaryText}>
                                {historyPlan.visited_count} of {historyPlan.planned_count} visited · {historyPlan.pending_count} pending
                            </Text>
                            {historyPlan.parties.map(p => (
                                <View key={p.id} style={styles.partyStatusRow}>
                                    <Text style={styles.partyStatusName}>{p.party_name} ({p.area})</Text>
                                    <Badge status={p.visited ? 'Visited' : 'Pending'} />
                                </View>
                            ))}
                        </>
                    )}
                </Card>
            </Screen>

            <FormModal
                visible={!!revisitParty}
                title={`Revisit — ${revisitParty?.party_name || ''}`}
                onClose={() => setRevisitParty(null)}
                onSubmit={submitRevisit}
                submitting={submitting}
                submitLabel="Save Visit"
            >
                <Field
                    label="What happened on this visit?"
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g. Shop is out of stock, will reorder next week"
                    multiline
                />
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    hint: { color: colors.textMuted, fontSize: 12.5, marginBottom: spacing.md },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: '100%', borderRadius: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    revisitBtn: {
        borderWidth: 1.5, borderColor: colors.brand, borderRadius: 10,
        paddingVertical: 10, alignItems: 'center', marginTop: spacing.md,
    },
    revisitBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    dateNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    dateNavBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    dateNavBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    dateLabel: { fontWeight: '700', color: colors.text, fontSize: 13 },
    summaryText: { fontWeight: '700', color: colors.text, fontSize: 13, marginBottom: spacing.sm },
    partyStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    partyStatusName: { fontSize: 12.5, color: colors.text, flex: 1, marginRight: spacing.sm },
});
