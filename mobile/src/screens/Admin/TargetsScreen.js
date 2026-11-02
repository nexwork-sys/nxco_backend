import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { Screen, Card, Button, Field, SectionTitle, EmptyState, Loading, StatCard } from '../../components/ui';
import FormModal from '../../components/FormModal';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Admin sets each Marketing employee's total quantity target for the
// month, plus the last date to complete it. Progress (achieved/remaining)
// is computed live from that employee's orders — as soon as an order is
// placed, their remaining target goes down.
export default function TargetsScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [users, setUsers] = useState([]);
    const [targets, setTargets] = useState([]);
    const [summary, setSummary] = useState({ total_target: 0, total_achieved: 0, total_remaining: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [selectedUser, setSelectedUser] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');

    const load = useCallback(async () => {
        const [usersRes, targetsRes] = await Promise.all([
            api.get('/pjp/marketing-users'),
            api.get('/targets'),
        ]);
        setUsers(usersRes.data.users || []);
        setTargets(targetsRes.data.targets || []);
        setSummary(targetsRes.data.summary || { total_target: 0, total_achieved: 0, total_remaining: 0 });
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    function openForm(existing) {
        if (existing) {
            setSelectedUser({ id: existing.assigned_to, name: existing.employee_name });
            setQuantity(String(existing.quantity_target));
            setEndDate(existing.end_date);
            setNotes(existing.notes || '');
        } else {
            setSelectedUser(null);
            setQuantity('');
            setEndDate('');
            setNotes('');
        }
        setFormVisible(true);
    }

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!selectedUser) { toast('Select a Marketing employee.', 'error'); return; }
        if (!quantity || Number(quantity) <= 0) { toast('Enter a total quantity target.', 'error'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { toast('Enter the last date as YYYY-MM-DD.', 'error'); return; }

        setSubmitting(true);
        const res = await api.post('/targets', {
            assigned_to: selectedUser.id,
            quantity_target: Number(quantity),
            end_date: endDate,
            notes,
        });
        setSubmitting(false);
        if (res.data.success) {
            toast(res.data.message || 'Target saved.');
            setFormVisible(false);
            load();
        } else {
            toast(res.data.message || 'Could not save target.', 'error');
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                <View style={styles.statsGrid}>
                    <StatCard label="Total Target" value={summary.total_target} />
                    <StatCard label="Achieved" value={summary.total_achieved} />
                    <StatCard label="Pending" value={summary.total_remaining} />
                </View>

                <Button title="+ Set Target for Employee" onPress={() => openForm(null)} style={{ marginBottom: spacing.lg }} />

                <SectionTitle>This Month's Targets</SectionTitle>
                {loading ? (
                    <Loading />
                ) : targets.length === 0 ? (
                    <EmptyState text="No targets set yet for this month." />
                ) : (
                    targets.map(t => (
                        <Pressable key={t.id} onPress={() => openForm(t)}>
                            <Card>
                                <View style={styles.row}>
                                    <Text style={styles.title}>{t.employee_name}</Text>
                                    <Text style={[styles.daysLeft, t.days_left <= 3 && { color: colors.danger }]}>
                                        {t.days_left >= 0 ? `${t.days_left}d left` : 'Overdue'}
                                    </Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${t.percent}%`, backgroundColor: t.completed ? colors.success || '#2e7d32' : colors.brand }]} />
                                </View>
                                <Text style={styles.muted}>
                                    {t.achieved} / {t.quantity_target} done · {t.remaining} pending · deadline {t.end_date}
                                </Text>
                                {t.notes ? <Text style={styles.muted}>📝 {t.notes}</Text> : null}
                            </Card>
                        </Pressable>
                    ))
                )}
            </Screen>

            <FormModal
                visible={formVisible}
                title={selectedUser ? `Target — ${selectedUser.name}` : 'Set Target'}
                onClose={() => setFormVisible(false)}
                onSubmit={submit}
                submitting={submitting}
                submitLabel="Save Target"
            >
                <Text style={styles.label}>Marketing Employee</Text>
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
                <Field
                    label="Total Quantity Target"
                    value={quantity}
                    onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 500"
                    keyboardType="numeric"
                />
                <Field
                    label="Last Date to Complete (YYYY-MM-DD)"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="e.g. 2026-09-30"
                />
                <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    daysLeft: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    chipText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
    chipTextActive: { color: '#fff' },
});
