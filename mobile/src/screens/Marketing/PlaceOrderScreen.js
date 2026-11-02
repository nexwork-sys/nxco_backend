import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pickImage } from '../../utils/imagePicker';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, Field, SectionTitle, EmptyState } from '../../components/ui';
import PaymentSection from '../../components/PaymentSection';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function PlaceOrderScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [parties, setParties] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedParty, setSelectedParty] = useState(null);
    const [qty, setQty] = useState({}); // productId -> string
    const [comment, setComment] = useState('');
    const [gstNo, setGstNo] = useState('');
    const [documents, setDocuments] = useState([]);
    // Payment is chosen per ORDER now: Cash, or Credit (goods now, money later against a cheque).
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [chequeNo, setChequeNo] = useState('');
    const [chequeImage, setChequeImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        const [partiesRes, productsRes] = await Promise.all([api.get('/parties'), api.get('/products')]);
        setParties(partiesRes.data.parties || []);
        setProducts(productsRes.data.products || []);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    function selectParty(p) {
        setSelectedParty(p);
        setQty({}); // rates differ per party — start the quantities over
    }

    // Only products this party has a negotiated rate for (from the Fill
    // Form) can actually be ordered — the backend rejects anything else.
    const rateByProduct = useMemo(() => {
        const map = new Map();
        (selectedParty?.product_rates || []).forEach(r => map.set(String(r.product_id), r.rate));
        return map;
    }, [selectedParty]);

    const orderableProducts = useMemo(
        () => products.filter(p => rateByProduct.has(String(p.id))),
        [products, rateByProduct]
    );

    function setQuantity(productId, stock, value) {
        const clean = value.replace(/[^0-9]/g, '');
        const capped = clean && Number(clean) > stock ? String(stock) : clean;
        if (clean && Number(clean) > stock) toast(`Only ${stock} in stock — quantity capped.`, 'error');
        setQty(q => ({ ...q, [productId]: capped }));
    }

    // Live running total — quantity × this party's rate for that product,
    // summed across every line that has a quantity entered.
    const total = useMemo(() => {
        return orderableProducts.reduce((sum, p) => {
            const q = Number(qty[p.id]) || 0;
            const rate = rateByProduct.get(String(p.id)) || 0;
            return sum + q * rate;
        }, 0);
    }, [orderableProducts, qty, rateByProduct]);

    async function pickDocument() {
        const asset = await pickImage();
        if (asset) setDocuments(docs => [...docs, asset]);
    }

    async function pickCheque() {
        const asset = await pickImage();
        if (asset) setChequeImage(asset);
    }

    async function submit() {
        // Re-entrancy guard: a fast double-tap (or an impatient second tap
        // while the request is still in flight) was firing this twice,
        // which placed the same order two times. Bail out immediately if
        // a submit is already running.
        if (submitting) return;

        const items = Object.entries(qty)
            .filter(([, v]) => Number(v) > 0)
            .map(([product_id, quantity]) => ({ product_id, quantity: Number(quantity) }));

        if (!selectedParty) { toast('Select a party first.', 'error'); return; }
        if (items.length === 0) { toast('Enter a quantity for at least one product.', 'error'); return; }
        if (paymentMode === 'Credit') {
            if (!chequeNo.trim()) { toast('Enter the cheque number for a Credit order.', 'error'); return; }
            if (!chequeImage) { toast('Add the cheque photo for a Credit order.', 'error'); return; }
        }

        setSubmitting(true);
        const fd = new FormData();
        fd.append('party_id', selectedParty.id);
        fd.append('products_json', JSON.stringify(items));
        fd.append('comment', comment);
        fd.append('gst_no', gstNo);
        fd.append('payment_mode', paymentMode);
        if (paymentMode === 'Credit') {
            fd.append('cheque_no', chequeNo.trim());
            fd.append('cheque_image', { uri: chequeImage.uri, name: 'cheque.jpg', type: 'image/jpeg' });
        }
        documents.forEach((doc, i) => fd.append('documents', { uri: doc.uri, name: `doc${i}.jpg`, type: 'image/jpeg' }));

        const res = await api.post('/orders', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSubmitting(false);
        if (res.data.success) {
            toast('Order placed.');
            setSelectedParty(null);
            setQty({});
            setComment('');
            setGstNo('');
            setDocuments([]);
            setPaymentMode('Cash');
            setChequeNo('');
            setChequeImage(null);
            load();
        } else {
            toast(res.data.message || 'Could not place order.', 'error');
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Place Order" />
            <Screen>
                <Card>
                    <SectionTitle>Select Party</SectionTitle>
                    {parties.length === 0 ? (
                        <EmptyState text="No parties yet — add one first." />
                    ) : (
                        <View style={styles.chipRow}>
                            {parties.map(p => (
                                <Pressable
                                    key={p.id}
                                    onPress={() => selectParty(p)}
                                    style={[styles.chip, selectedParty?.id === p.id && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, selectedParty?.id === p.id && styles.chipTextActive]}>
                                        {p.party_name}{!p.fill_form_completed ? ' ⚠️' : ''}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </Card>

                <Card>
                    <SectionTitle>Products & Quantity</SectionTitle>
                    {!selectedParty ? (
                        <EmptyState text="Select a party above to see its rates." />
                    ) : orderableProducts.length === 0 ? (
                        <EmptyState text="No rates set for this party yet — ask Admin/Manager to complete its Fill Form." />
                    ) : (
                        orderableProducts.map(p => {
                            const rate = rateByProduct.get(String(p.id));
                            const q = Number(qty[p.id]) || 0;
                            return (
                                <View key={p.id} style={styles.productRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.productName}>{p.brand_name} — {p.product_name}</Text>
                                        <Text style={styles.muted}>
                                            Stock: {p.quantity}{p.quantity <= 0 ? ' — out of stock' : ''} · Rate: ₹{rate}
                                        </Text>
                                        {q > 0 && <Text style={styles.amount}>= ₹{(q * rate).toFixed(2)}</Text>}
                                    </View>
                                    <Field
                                        value={qty[p.id] || ''}
                                        onChangeText={v => setQuantity(p.id, p.quantity, v)}
                                        placeholder="Qty"
                                        keyboardType="numeric"
                                        editable={p.quantity > 0}
                                    />
                                </View>
                            );
                        })
                    )}
                    {total > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
                        </View>
                    )}
                </Card>

                <Card>
                    <SectionTitle>Payment</SectionTitle>
                    <PaymentSection
                        mode={paymentMode}
                        onModeChange={setPaymentMode}
                        chequeNo={chequeNo}
                        onChequeNoChange={setChequeNo}
                        chequeImage={chequeImage}
                        onPickCheque={pickCheque}
                    />
                </Card>

                <Card>
                    <SectionTitle>Extra Details</SectionTitle>
                    <Field label="Comment / Note" value={comment} onChangeText={setComment} placeholder="e.g. Deliver by 6pm, COD" multiline />
                    <Field label="GST No. (optional)" value={gstNo} onChangeText={setGstNo} />
                    <Button title={`📎 Attach Document (${documents.length})`} variant="outline" onPress={pickDocument} style={{ marginTop: spacing.sm }} />
                </Card>

                <Button title="Place Order" onPress={submit} loading={submitting} disabled={submitting} />
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    chipText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
    chipTextActive: { color: '#fff' },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    productName: { fontWeight: '600', color: colors.text, fontSize: 13.5 },
    muted: { color: colors.textMuted, fontSize: 12 },
    amount: { color: colors.brandDark, fontWeight: '700', fontSize: 12.5, marginTop: 2 },
    totalRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    },
    totalLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
    totalValue: { fontSize: 18, fontWeight: '800', color: colors.brandDark },
});
