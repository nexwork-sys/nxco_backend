import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Badge, Field, EmptyState, Loading } from '../../components/ui';
import PaymentSection, { OrderPaymentInfo } from '../../components/PaymentSection';
import { pickImage } from '../../utils/imagePicker';
import FormModal from '../../components/FormModal';
import { toast } from '../../components/Toast';
import { orderItemsSummary } from '../../utils/orders';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function MyOrdersScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editQty, setEditQty] = useState({});
    const [editComment, setEditComment] = useState('');
    const [editPaymentMode, setEditPaymentMode] = useState('Cash');
    const [editChequeNo, setEditChequeNo] = useState('');
    const [editChequeImage, setEditChequeImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        const [ordersRes, productsRes] = await Promise.all([api.get('/orders'), api.get('/products')]);
        setOrders(ordersRes.data.orders || []);
        setProducts(productsRes.data.products || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    function openEdit(order) {
        const q = {};
        order.items.forEach(it => { q[it.product_id] = String(it.quantity); });
        setEditQty(q);
        setEditComment(order.comment || '');
        setEditPaymentMode(order.payment_mode || 'Cash');
        setEditChequeNo(order.cheque_no || '');
        setEditChequeImage(null);
        setEditing(order);
    }

    async function submitEdit() {
        if (submitting) return; // re-entrancy guard against double-tap
        const items = Object.entries(editQty)
            .filter(([, v]) => Number(v) > 0)
            .map(([product_id, quantity]) => ({ product_id, quantity: Number(quantity) }));
        if (items.length === 0) { toast('At least one product with quantity is required.', 'error'); return; }
        if (editPaymentMode === 'Credit') {
            if (!editChequeNo.trim()) { toast('Enter the cheque number for a Credit order.', 'error'); return; }
            if (!editChequeImage && !editing.cheque_image) { toast('Add the cheque photo for a Credit order.', 'error'); return; }
        }

        setSubmitting(true);
        const fd = new FormData();
        fd.append('products_json', JSON.stringify(items));
        fd.append('comment', editComment);
        fd.append('payment_mode', editPaymentMode);
        if (editPaymentMode === 'Credit') {
            fd.append('cheque_no', editChequeNo.trim());
            if (editChequeImage) fd.append('cheque_image', { uri: editChequeImage.uri, name: 'cheque.jpg', type: 'image/jpeg' });
        }
        const res = await api.post(`/orders/${editing.id}/update`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSubmitting(false);
        if (res.data.success) {
            toast('Order updated.');
            setEditing(null);
            load();
        } else {
            toast(res.data.message || 'Could not update order.', 'error');
        }
    }

    function confirmDelete(order) {
        Alert.alert('Delete order?', `Order for ${order.party?.party_name} will be removed and stock returned.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove(order) },
        ]);
    }

    async function remove(order) {
        const res = await api.post(`/orders/${order.id}/delete`);
        if (res.data.success) { toast('Order deleted.'); load(); }
        else toast(res.data.message || 'Could not delete.', 'error');
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="My Orders" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                {loading ? (
                    <Loading />
                ) : orders.length === 0 ? (
                    <EmptyState text="No orders placed yet." />
                ) : (
                    orders.map(o => (
                        <Card key={o.id}>
                            <View style={styles.row}>
                                <Text style={styles.title}>#{String(o.id).slice(-6)} — {o.party?.party_name}</Text>
                                <Badge status={o.status} />
                            </View>
                            <Text style={styles.items}>{orderItemsSummary(o)}</Text>
                            <OrderPaymentInfo order={o} />
                            <Text style={styles.muted}>{new Date(o.created_at).toLocaleDateString()}</Text>
                            {o.status === 'Pending' ? (
                                <View style={styles.actions}>
                                    <Pressable onPress={() => openEdit(o)}><Text style={styles.actionText}>Edit</Text></Pressable>
                                    <Pressable onPress={() => confirmDelete(o)}><Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text></Pressable>
                                </View>
                            ) : (
                                <Text style={[styles.muted, { marginTop: spacing.sm }]}>🔒 Locked — no longer Pending</Text>
                            )}
                        </Card>
                    ))
                )}
            </Screen>

            <FormModal
                visible={!!editing}
                title={`Edit Order #${editing ? String(editing.id).slice(-6) : ''}`}
                onClose={() => setEditing(null)}
                onSubmit={submitEdit}
                submitting={submitting}
                submitLabel="Update Order"
            >
                {products.map(p => (
                    <View key={p.id} style={styles.editRow}>
                        <Text style={styles.editLabel}>{p.brand_name} — {p.product_name} (stock: {p.quantity})</Text>
                        <Field
                            value={editQty[p.id] || ''}
                            onChangeText={v => setEditQty(q => ({ ...q, [p.id]: v.replace(/[^0-9]/g, '') }))}
                            placeholder="0"
                            keyboardType="numeric"
                        />
                    </View>
                ))}
                <Field label="Comment" value={editComment} onChangeText={setEditComment} multiline />
                <PaymentSection
                    mode={editPaymentMode}
                    onModeChange={setEditPaymentMode}
                    chequeNo={editChequeNo}
                    onChequeNoChange={setEditChequeNo}
                    chequeImage={editChequeImage}
                    existingChequeImage={editing?.cheque_image}
                    onPickCheque={async () => { const a = await pickImage(); if (a) setEditChequeImage(a); }}
                />
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontWeight: '700', flex: 1, marginRight: spacing.sm },
    items: { fontSize: 13, marginTop: 4 },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    actionText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    editRow: { marginBottom: spacing.sm },
    editLabel: { fontSize: 12.5, fontWeight: '600', color: colors.text, marginBottom: 4 },
});
