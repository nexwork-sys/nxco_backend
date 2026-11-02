import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Badge, EmptyState, Loading } from '../../components/ui';
import { orderItemsSummary } from '../../utils/orders';
import { OrderPaymentInfo } from '../../components/PaymentSection';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Only the statuses Supervisor/Manager/Operator are actually allowed to set
// (matches STATUS_PERMISSIONS on the backend) — Admin-only web app shows a
// full dropdown, but on this role's app we only offer valid next steps.
const SETTABLE = ['Confirmed', 'Ready to Dispatch', 'Cancelled'];

export default function OrdersScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const res = await api.get('/orders');
        setOrders(res.data.orders || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    async function setStatus(order, status) {
        const res = await api.post(`/orders/${order.id}/status`, { status });
        if (res.data.success) { toast(res.data.message); load(); }
        else toast(res.data.message || 'Could not update.', 'error');
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Incoming Orders" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                {loading ? (
                    <Loading />
                ) : orders.length === 0 ? (
                    <EmptyState text="No incoming orders yet." />
                ) : (
                    orders.map(o => (
                        <Card key={o.id}>
                            <View style={styles.row}>
                                <Text style={styles.title}>#{String(o.id).slice(-6)} — {o.party?.party_name}</Text>
                                <Badge status={o.status} />
                            </View>
                            <Text style={styles.muted}>Placed by {o.created_by_name}</Text>
                            <Text style={styles.sectionLabel}>What to Give</Text>
                            <Text style={styles.items}>{orderItemsSummary(o)}</Text>
                            <OrderPaymentInfo order={o} />
                            {o.comment ? <Text style={styles.comment}>📝 {o.comment}</Text> : null}

                            <View style={styles.statusRow}>
                                {SETTABLE.filter(s => s !== o.status).map(s => (
                                    <Pressable key={s} onPress={() => setStatus(o, s)} style={styles.statusChip}>
                                        <Text style={styles.statusChipText}>{s}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </Card>
                    ))
                )}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontWeight: '700', flex: 1, marginRight: spacing.sm },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    sectionLabel: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginTop: spacing.sm },
    items: { fontSize: 13, marginTop: 2 },
    comment: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
    statusChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    statusChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
