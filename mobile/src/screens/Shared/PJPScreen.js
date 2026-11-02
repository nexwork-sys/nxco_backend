import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { Screen, Card, Button, Field, SectionTitle, EmptyState, Loading, Badge } from '../../components/ui';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { todayIST } from '../../utils/format';

// Admin/Manager builds today's journey plan (PJP) for one Marketing
// employee: pick who, pick which parties to visit today, save. The
// Marketing employee then sees this on their own "My Plan" screen.
export default function PJPScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [users, setUsers] = useState([]);
    const [parties, setParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedPartyIds, setSelectedPartyIds] = useState([]);
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Revisit status — "did the planned visit actually happen" — for a
    // chosen date (defaults to today), visible to Admin and to whichever
    // Manager built the plan. Doesn't disappear once the date has passed.
    const [statusDate, setStatusDate] = useState(todayIST());
    const [statusPlans, setStatusPlans] = useState([]);
    const [statusSummary, setStatusSummary] = useState({ planned: 0, visited: 0, pending: 0 });
    const [statusLoading, setStatusLoading] = useState(true);

    const loadStatus = useCallback(async (date) => {
        setStatusLoading(true);
        const res = await api.get('/pjp/status', { params: { date } });
        setStatusPlans(res.data.plans || []);
        setStatusSummary(res.data.summary || { planned: 0, visited: 0, pending: 0 });
        setStatusLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { loadStatus(statusDate); }, [loadStatus, statusDate]));

    const load = useCallback(async () => {
        const [usersRes, partiesRes] = await Promise.all([
            api.get('/pjp/marketing-users'),
            api.get('/parties'),
        ]);
        setUsers(usersRes.data.users || []);
        setParties(partiesRes.data.parties || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    function toggleParty(id) {
        setSelectedPartyIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
    }

    const filteredParties = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return parties;
        return parties.filter(p => (
            (p.party_name || '').toLowerCase().includes(q) ||
            (p.area || '').toLowerCase().includes(q)
        ));
    }, [parties, search]);

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!selectedUser) { toast('Select a Marketing employee first.', 'error'); return; }
        if (selectedPartyIds.length === 0) { toast('Select at least one party to visit.', 'error'); return; }

        setSubmitting(true);
        const res = await api.post('/pjp', { assigned_to: selectedUser.id, party_ids: selectedPartyIds });
        setSubmitting(false);
        if (res.data.success) {
            toast(`Plan saved for ${selectedUser.name} — ${selectedPartyIds.length} ${selectedPartyIds.length === 1 ? 'party' : 'parties'}.`);
            setSelectedPartyIds([]);
            loadStatus(statusDate);
        } else {
            toast(res.data.message || 'Could not save plan.', 'error');
        }
    }

    function shiftStatusDate(days) {
        const d = new Date(`${statusDate}T00:00:00`);
        d.setDate(d.getDate() + days);
        setStatusDate(d.toISOString().slice(0, 10));
    }

    return (
        <Screen>
            {loading ? (
                <Loading />
            ) : (
                <>
                    <Card>
                        <SectionTitle>Assign To</SectionTitle>
                        {users.length === 0 ? (
                            <EmptyState text="No Marketing employees found." />
                        ) : (
                            <View style={styles.chipRow}>
                                {users.map(u => (
                                    <Pressable
                                        key={u.id}
                                        onPress={() => setSelectedUser(u)}
                                        style={[styles.chip, selectedUser?.id === u.id && styles.chipActive]}
                                    >
                                        <Text style={[styles.chipText, selectedUser?.id === u.id && styles.chipTextActive]}>{u.name}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </Card>

                    <Card>
                        <SectionTitle>Today's Parties to Visit ({selectedPartyIds.length} selected)</SectionTitle>
                        <Field value={search} onChangeText={setSearch} placeholder="Search area or party…" />
                        {filteredParties.length === 0 ? (
                            <EmptyState text="No parties found." />
                        ) : (
                            <View style={styles.chipRow}>
                                {filteredParties.map(p => {
                                    const selected = selectedPartyIds.includes(p.id);
                                    return (
                                        <Pressable
                                            key={p.id}
                                            onPress={() => toggleParty(p.id)}
                                            style={[styles.chip, selected && styles.chipActive]}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                                                {p.party_name} ({p.area})
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </Card>

                    <Button title="Save Today's Plan" onPress={submit} loading={submitting} disabled={submitting} />

                    <Card style={{ marginTop: spacing.lg }}>
                        <SectionTitle>Revisit Status</SectionTitle>
                        <Text style={styles.hint}>
                            Who was planned to visit whom, and whether the visit actually happened — stays here even after the day is over.
                        </Text>
                        <View style={styles.dateNavRow}>
                            <Pressable onPress={() => shiftStatusDate(-1)} style={styles.dateNavBtn}>
                                <Text style={styles.dateNavBtnText}>‹ Prev</Text>
                            </Pressable>
                            <Text style={styles.dateLabel}>{statusDate}{statusDate === todayIST() ? ' (Today)' : ''}</Text>
                            <Pressable onPress={() => shiftStatusDate(1)} style={styles.dateNavBtn}>
                                <Text style={styles.dateNavBtnText}>Next ›</Text>
                            </Pressable>
                        </View>

                        {statusLoading ? (
                            <Loading />
                        ) : statusPlans.length === 0 ? (
                            <EmptyState text="No plan was set for this date." />
                        ) : (
                            <>
                                <Text style={styles.summaryText}>
                                    {statusSummary.visited} of {statusSummary.planned} visited · {statusSummary.pending} pending
                                </Text>
                                {statusPlans.map(plan => (
                                    <View key={plan.id} style={styles.planBlock}>
                                        <View style={styles.planHeaderRow}>
                                            <Text style={styles.planEmployee}>{plan.employee_name}</Text>
                                            <Text style={styles.planCounts}>{plan.visited_count}/{plan.planned_count} visited</Text>
                                        </View>
                                        {plan.parties.map(p => (
                                            <View key={p.id} style={styles.partyStatusRow}>
                                                <Text style={styles.partyStatusName}>{p.party_name} ({p.area})</Text>
                                                <Badge status={p.visited ? 'Visited' : 'Pending'} />
                                            </View>
                                        ))}
                                    </View>
                                ))}
                            </>
                        )}
                    </Card>
                </>
            )}
        </Screen>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    chipText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
    chipTextActive: { color: '#fff' },
    hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
    dateNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    dateNavBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    dateNavBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    dateLabel: { fontWeight: '700', color: colors.text, fontSize: 13 },
    summaryText: { fontWeight: '700', color: colors.text, fontSize: 13, marginBottom: spacing.sm },
    planBlock: { marginBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    planEmployee: { fontWeight: '700', fontSize: 13.5, color: colors.text },
    planCounts: { fontSize: 12, color: colors.textMuted },
    partyStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    partyStatusName: { fontSize: 12.5, color: colors.text, flex: 1, marginRight: spacing.sm },
});
