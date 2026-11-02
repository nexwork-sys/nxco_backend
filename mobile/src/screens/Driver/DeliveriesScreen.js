import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, Badge, EmptyState, Loading, Field } from '../../components/ui';
import FormModal from '../../components/FormModal';
import { OrderPaymentInfo } from '../../components/PaymentSection';
import { toast } from '../../components/Toast';
import { orderItemsSummary, mapsDirectionsUrl } from '../../utils/orders';
import { spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function DeliveriesScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Payment-collection modal shown when a driver marks a delivery
    // Completed with money in hand — captures how much and Cash vs
    // Online, so Admin/Marketing can see exactly what was collected and
    // what's still due from the party.
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [completing, setCompleting] = useState(false);

    const load = useCallback(async () => {
        const res = await api.get('/orders');
        setOrders(res.data.orders || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    async function startDelivery(order) {
        const res = await api.post(`/orders/${order.id}/status`, { status: 'On the Way' });
        if (res.data.success) { toast('Delivery started.'); load(); }
        else toast(res.data.message || 'Could not start delivery.', 'error');
    }

    function confirmComplete(order) {
        Alert.alert('Mark as completed?', 'Was payment collected for this order?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'No payment', onPress: () => complete(order, false) },
            {
                text: 'Yes, collected',
                onPress: () => {
                    setPaymentOrder(order);
                    setPaymentAmount(order.total ? String(order.total) : '');
                    setPaymentMethod('Cash');
                },
            },
        ]);
    }

    async function complete(order, paymentCollected, amount, method) {
        const res = await api.post(`/orders/${order.id}/status`, {
            status: 'Completed',
            payment_collected: paymentCollected,
            ...(paymentCollected ? { amount_collected: amount, payment_method: method } : {}),
        });
        if (res.data.success) { toast('Order marked completed.'); load(); }
        else toast(res.data.message || 'Could not complete order.', 'error');
    }

    async function submitPayment() {
        if (completing) return; // re-entrancy guard against double-tap
        const amount = Number(paymentAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast('Enter how much was collected.', 'error');
            return;
        }
        setCompleting(true);
        await complete(paymentOrder, true, amount, paymentMethod);
        setCompleting(false);
        setPaymentOrder(null);
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="My Deliveries" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                {loading ? (
                    <Loading />
                ) : orders.length === 0 ? (
                    <EmptyState text="No deliveries assigned right now." />
                ) : (
                    orders.map(o => (
                        <Card key={o.id}>
                            <View style={styles.row}>
                                <Text style={styles.title}>#{String(o.id).slice(-6)} — {o.party?.party_name}</Text>
                                <Badge status={o.status} />
                            </View>
                            <Text style={styles.muted}>{o.party?.address}{o.party?.address ? ', ' : ''}{o.party?.area}, {o.party?.city}</Text>
                            <Text style={styles.items}>{orderItemsSummary(o)}</Text>
                            <OrderPaymentInfo order={o} showCheque={false} />
                            {o.comment ? <Text style={styles.comment}>📝 {o.comment}</Text> : null}

                            <View style={styles.linkRow}>
                                {o.party?.mobile && (
                                    <Pressable onPress={() => Linking.openURL(`tel:${o.party.mobile}`)} style={styles.linkBtn}>
                                        <Text style={styles.linkText}>📞 Call Party</Text>
                                    </Pressable>
                                )}
                                {o.party?.lat && o.party?.lng && (
                                    <Pressable onPress={() => Linking.openURL(mapsDirectionsUrl(o.party.lat, o.party.lng))} style={styles.linkBtn}>
                                        <Text style={styles.linkText}>🧭 Get Directions</Text>
                                    </Pressable>
                                )}
                            </View>

                            {o.status === 'Ready to Dispatch' && (
                                <Button title="🚚 Start Delivery" onPress={() => startDelivery(o)} style={{ marginTop: spacing.md }} />
                            )}
                            {o.status === 'On the Way' && (
                                <Button title="✅ Mark Completed" onPress={() => confirmComplete(o)} style={{ marginTop: spacing.md }} />
                            )}
                        </Card>
                    ))
                )}
            </Screen>

            <FormModal
                visible={!!paymentOrder}
                title={`Payment Collected — #${paymentOrder ? String(paymentOrder.id).slice(-6) : ''}`}
                onClose={() => setPaymentOrder(null)}
                onSubmit={submitPayment}
                submitting={completing}
                submitLabel="Mark Completed"
            >
                <Field
                    label="Amount collected (₹)"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    placeholder="e.g. 1500"
                    keyboardType="numeric"
                />
                <Text style={styles.methodLabel}>Payment method</Text>
                <View style={styles.methodRow}>
                    {['Cash', 'Online'].map(m => (
                        <Pressable
                            key={m}
                            onPress={() => setPaymentMethod(m)}
                            style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                        >
                            <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>
                                {m === 'Cash' ? '💵 Cash' : '📲 Online'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontWeight: '700', flex: 1, marginRight: spacing.sm },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    items: { fontSize: 13, marginTop: 4 },
    comment: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
    linkRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    linkBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    linkText: { fontSize: 12.5, fontWeight: '700', color: colors.brandDark },
    methodLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
    methodRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    methodBtn: {
        flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm,
        paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surfaceAlt,
    },
    methodBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
    methodBtnText: { fontWeight: '700', color: colors.text, fontSize: 13.5 },
    methodBtnTextActive: { color: colors.brandDark },
});
