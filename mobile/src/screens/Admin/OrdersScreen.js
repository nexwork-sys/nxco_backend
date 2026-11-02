import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { API_BASE } from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Badge, EmptyState, Loading, Button } from '../../components/ui';
import { orderItemsSummary, deleteOrderMessage } from '../../utils/orders';
import { OrderPaymentInfo } from '../../components/PaymentSection';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const ALL_STATUSES = ['Pending', 'Confirmed', 'Ready to Dispatch', 'On the Way', 'Completed', 'Cancelled'];

export default function OrdersScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);

    const load = useCallback(async () => {
        const res = await api.get('/orders');
        setOrders(res.data.orders || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    async function setStatus(order, status) {
        const res = await api.post(`/orders/${order.id}/status`, { status });
        if (res.data.success) {
            toast(res.data.message);
            load();
        } else {
            toast(res.data.message || 'Could not update status.', 'error');
        }
    }

    function confirmDeleteOrder(order) {
        Alert.alert('Delete order?', deleteOrderMessage(order), [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteOrder(order) },
        ]);
    }

    async function deleteOrder(order) {
        const res = await api.post(`/orders/${order.id}/delete`);
        if (res.data.success) {
            toast('Order deleted.');
            load();
        } else {
            toast(res.data.message || 'Could not delete.', 'error');
        }
    }

    // Downloads the server-generated invoice PDF for one order and opens
    // the native share/save sheet — the same pattern the Attendance CSV
    // export uses, but streaming a PDF straight from the API instead of
    // building the file on-device.
    async function downloadInvoice(order) {
        if (downloadingId) return; // re-entrancy guard against double-tap
        setDownloadingId(order.id);
        try {
            const token = await AsyncStorage.getItem('nxco_token');
            const fileUri = `${FileSystem.cacheDirectory}invoice_${order.id}.pdf`;
            const result = await FileSystem.downloadAsync(`${API_BASE}/api/orders/${order.id}/invoice`, fileUri, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (result.status !== 200) {
                toast('Could not generate the invoice.', 'error');
                return;
            }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Order Invoice' });
            } else {
                toast(`Saved to ${fileUri}`, 'success');
            }
        } catch (e) {
            toast('Could not download the invoice.', 'error');
        } finally {
            setDownloadingId(null);
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="All Orders" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                {loading ? (
                    <Loading />
                ) : orders.length === 0 ? (
                    <EmptyState text="No orders yet." />
                ) : (
                    orders.map(o => (
                        <Card key={o.id}>
                            <View style={styles.row}>
                                <Text style={styles.title}>#{String(o.id).slice(-6)} — {o.party?.party_name}</Text>
                                <Badge status={o.status} />
                            </View>
                            <Text style={styles.muted}>Placed by {o.created_by_name} · {new Date(o.created_at).toLocaleDateString()}</Text>
                            <Text style={styles.items}>{orderItemsSummary(o)}</Text>
                            <OrderPaymentInfo order={o} />
                            {o.comment ? <Text style={styles.comment}>📝 {o.comment}</Text> : null}

                            <Button
                                title={downloadingId === o.id ? 'Preparing…' : '⬇️ Download Invoice (PDF)'}
                                variant="outline"
                                onPress={() => downloadInvoice(o)}
                                loading={downloadingId === o.id}
                                style={{ marginTop: spacing.md }}
                            />

                            <Text style={[styles.muted, { marginTop: spacing.md, marginBottom: 6 }]}>Change status</Text>
                            <View style={styles.statusRow}>
                                {ALL_STATUSES.filter(s => s !== o.status).map(s => (
                                    <Pressable key={s} onPress={() => setStatus(o, s)} style={styles.statusChip}>
                                        <Text style={styles.statusChipText}>{s}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Pressable onPress={() => confirmDeleteOrder(o)} style={styles.deleteBtn}>
                                <Text style={styles.deleteBtnText}>🗑️ Delete Order</Text>
                            </Pressable>
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
    items: { fontSize: 13, marginTop: 4 },
    comment: { fontSize: 12.5, color: colors.textMuted, marginTop: 4 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    statusChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    deleteBtn: { alignItems: 'center', paddingVertical: 10, marginTop: spacing.md },
    deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
