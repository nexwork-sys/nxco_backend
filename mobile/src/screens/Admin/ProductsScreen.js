import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { Screen, Card, Button, Field, EmptyState, Loading } from '../../components/ui';
import FormModal from '../../components/FormModal';
import { toast } from '../../components/Toast';
import { formatDateTime } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const emptyForm = { brand_name: '', product_name: '', quantity: '0', rate: '' };

export default function ProductsScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    const [stockModalVisible, setStockModalVisible] = useState(false);
    const [stockProduct, setStockProduct] = useState(null);
    const [stockQty, setStockQty] = useState('');
    const [stockSubmitting, setStockSubmitting] = useState(false);

    const load = useCallback(async () => {
        const res = await api.get('/products');
        setProducts(res.data.products || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    function openAdd() { setEditing(null); setForm(emptyForm); setModalVisible(true); }
    function openEdit(p) {
        setEditing(p);
        setForm({ brand_name: p.brand_name, product_name: p.product_name, quantity: String(p.quantity), rate: p.rate != null ? String(p.rate) : '' });
        setModalVisible(true);
    }

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!form.brand_name || !form.product_name) {
            toast('Brand and product name are required.', 'error');
            return;
        }
        setSubmitting(true);
        const url = editing ? `/products/${editing.id}/update` : '/products';
        const res = await api.post(url, form);
        setSubmitting(false);
        if (res.data.success) {
            toast(editing ? 'Product updated.' : 'Product added.');
            setModalVisible(false);
            load();
        } else {
            toast(res.data.message || 'Could not save product.', 'error');
        }
    }

    function openStockUpdate(p) {
        setStockProduct(p);
        setStockQty('');
        setStockModalVisible(true);
    }

    async function submitStock() {
        if (stockSubmitting) return; // re-entrancy guard against double-tap
        const qty = Number(stockQty);
        if (!stockQty || !Number.isFinite(qty) || qty <= 0) {
            toast('Enter a valid quantity to add.', 'error');
            return;
        }
        setStockSubmitting(true);
        const res = await api.post(`/products/${stockProduct.id}/add-stock`, { quantity: qty });
        setStockSubmitting(false);
        if (res.data.success) {
            toast(`Stock updated. New quantity: ${res.data.quantity}.`);
            setStockModalVisible(false);
            load();
        } else {
            toast(res.data.message || 'Could not update stock.', 'error');
        }
    }

    async function remove(p) {
        const res = await api.post(`/products/${p.id}/delete`);
        if (res.data.success) { toast('Product deleted.'); load(); }
        else toast(res.data.message || 'Could not delete.', 'error');
    }

    return (
        <View style={{ flex: 1 }}>
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                <Button title="+ Add Product" onPress={openAdd} style={{ marginBottom: spacing.lg }} />
                {loading ? (
                    <Loading />
                ) : products.length === 0 ? (
                    <EmptyState text="No products yet." />
                ) : (
                    products.map(p => (
                        <Card key={p.id}>
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.title}>{p.brand_name} — {p.product_name}</Text>
                                    <Text style={styles.muted}>Stock: {p.quantity} {p.rate ? `· ₹${p.rate}` : ''}</Text>
                                </View>
                                <Text style={styles.updated}>Updated{'\n'}{formatDateTime(p.updatedAt)}</Text>
                                <Pressable onPress={() => openStockUpdate(p)}>
                                    <Text style={styles.actionText}>Update Inventory</Text>
                                </Pressable>
                                <Pressable onPress={() => openEdit(p)} style={{ marginLeft: spacing.md }}>
                                    <Text style={styles.actionText}>Edit</Text>
                                </Pressable>
                                {user?.role === 'Admin' && (
                                    <Pressable onPress={() => remove(p)} style={{ marginLeft: spacing.md }}>
                                        <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                                    </Pressable>
                                )}
                            </View>
                        </Card>
                    ))
                )}
            </Screen>

            <FormModal
                visible={modalVisible}
                title={editing ? 'Edit Product' : 'Add Product'}
                onClose={() => setModalVisible(false)}
                onSubmit={submit}
                submitting={submitting}
                submitLabel={editing ? 'Update' : 'Add'}
            >
                <Field label="Brand Name" value={form.brand_name} onChangeText={v => setForm(f => ({ ...f, brand_name: v }))} />
                <Field label="Product Name" value={form.product_name} onChangeText={v => setForm(f => ({ ...f, product_name: v }))} />
                <Field label="Quantity in Stock" value={form.quantity} onChangeText={v => setForm(f => ({ ...f, quantity: v }))} keyboardType="numeric" />
                <Field label="Rate (optional)" value={form.rate} onChangeText={v => setForm(f => ({ ...f, rate: v }))} keyboardType="numeric" />
            </FormModal>

            <FormModal
                visible={stockModalVisible}
                title={stockProduct ? `Update Inventory — ${stockProduct.brand_name} ${stockProduct.product_name}` : 'Update Inventory'}
                onClose={() => setStockModalVisible(false)}
                onSubmit={submitStock}
                submitting={stockSubmitting}
                submitLabel="Save"
            >
                {stockProduct && (
                    <Text style={styles.muted}>Current stock: {stockProduct.quantity}</Text>
                )}
                <Field
                    label="Quantity to Add"
                    value={stockQty}
                    onChangeText={setStockQty}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                />
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    updated: { color: colors.textMuted, fontSize: 10.5, marginRight: spacing.md, textAlign: 'right' },
    actionText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
});
