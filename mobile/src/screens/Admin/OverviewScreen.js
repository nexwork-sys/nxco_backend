import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { API_BASE } from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, SectionTitle, Badge, StatCard, EmptyState, Loading, Button } from '../../components/ui';
import { toast } from '../../components/Toast';
import { orderItemsSummary, deleteOrderMessage } from '../../utils/orders';
import { OrderPaymentInfo } from '../../components/PaymentSection';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function OverviewScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        present_today: 0, total_parties: 0, current_orders: 0, completed_orders: 0,
        target_total: 0, target_achieved: 0, target_remaining: 0, target_employee_count: 0,
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const [pjpSummary, setPjpSummary] = useState({ planned: 0, visited: 0, pending: 0 });
    const [pjpPlans, setPjpPlans] = useState([]);

    const load = useCallback(async () => {
        const [statsRes, orders, pjpRes] = await Promise.all([
            api.get('/dashboard/stats'),
            api.get('/orders'),
            api.get('/pjp/status'), // today's plan, across every Marketing employee
        ]);
        setStats(statsRes.data);
        setRecentOrders((orders.data.orders || []).slice(0, 8));
        setPjpSummary(pjpRes.data.summary || { planned: 0, visited: 0, pending: 0 });
        setPjpPlans(pjpRes.data.plans || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    // Downloads the server-generated invoice PDF for one order and opens
    // the native share/save sheet — same pattern as the Orders screen.
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

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Overview" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                {loading ? (
                    <Loading />
                ) : (
                    <>
                        <View style={styles.statsGrid}>
                            <StatCard label="Present Today" value={stats.present_today} />
                            <StatCard label="Current Orders" value={stats.current_orders} />
                            <StatCard label="Completed Orders" value={stats.completed_orders} />
                            <StatCard label="Total Parties" value={stats.total_parties} />
                        </View>

                        <SectionTitle>This Month's Target (All Marketing)</SectionTitle>
                        <Pressable onPress={() => navigation.navigate('More', { screen: 'Targets' })}>
                            <Card>
                                {stats.target_employee_count === 0 ? (
                                    <Text style={styles.muted}>No targets set yet. Tap to set targets for your Marketing team.</Text>
                                ) : (
                                    <>
                                        <View style={styles.progressTrack}>
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${stats.target_total > 0 ? Math.min(100, Math.round((stats.target_achieved / stats.target_total) * 100)) : 0}%`,
                                                        backgroundColor: colors.brand,
                                                    },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.muted}>
                                            {stats.target_achieved} / {stats.target_total} units done · {stats.target_remaining} pending across {stats.target_employee_count} employees
                                        </Text>
                                        <Text style={styles.link}>View / edit targets ›</Text>
                                    </>
                                )}
                            </Card>
                        </Pressable>

                        <SectionTitle>Today's PJP (Visit Plan)</SectionTitle>
                        <Pressable onPress={() => navigation.navigate('More', { screen: 'PJP' })}>
                            <Card>
                                {pjpPlans.length === 0 ? (
                                    <Text style={styles.muted}>No plan set for today yet. Tap to assign parties to your Marketing team.</Text>
                                ) : (
                                    <>
                                        <Text style={styles.muted}>
                                            {pjpSummary.visited} / {pjpSummary.planned} visited · {pjpSummary.pending} pending across {pjpPlans.length} {pjpPlans.length === 1 ? 'employee' : 'employees'}
                                        </Text>
                                        <Text style={styles.link}>View plan / revisit status ›</Text>
                                    </>
                                )}
                            </Card>
                        </Pressable>

                        <SectionTitle>Recent Orders</SectionTitle>
                        {recentOrders.length === 0 ? (
                            <EmptyState text="No orders yet." />
                        ) : (
                            recentOrders.map(o => (
                                <Card key={o.id}>
                                    <View style={styles.row}>
                                        <Text style={styles.orderTitle}>#{String(o.id).slice(-6)} — {o.party?.party_name}</Text>
                                        <Badge status={o.status} />
                                    </View>
                                    <Text style={styles.muted}>Placed by {o.created_by_name}</Text>
                                    <Text style={styles.items}>{orderItemsSummary(o)}</Text>
                                    <OrderPaymentInfo order={o} />
                                    <Text style={styles.muted}>{new Date(o.created_at).toLocaleString()}</Text>

                                    <Button
                                        title={downloadingId === o.id ? 'Preparing…' : '⬇️ Download Invoice (PDF)'}
                                        variant="outline"
                                        onPress={() => downloadInvoice(o)}
                                        loading={downloadingId === o.id}
                                        style={{ marginTop: spacing.md }}
                                    />
                                    {/* Admin can delete an order in any status — it is removed completely. */}
                                    <Pressable onPress={() => confirmDeleteOrder(o)} style={styles.deleteBtn}>
                                        <Text style={styles.deleteBtnText}>🗑️ Delete Order</Text>
                                    </Pressable>
                                </Card>
                            ))
                        )}
                    </>
                )}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    orderTitle: { fontWeight: '700', flex: 1, marginRight: spacing.sm },
    muted: { color: '#5c6b64', fontSize: 12.5, marginTop: 2 },
    items: { fontSize: 13, marginTop: 4 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 4 },
    link: { color: colors.brandDark, fontWeight: '700', fontSize: 12.5, marginTop: 8 },
    deleteBtn: { alignItems: 'center', paddingVertical: 10, marginTop: spacing.sm },
    deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
