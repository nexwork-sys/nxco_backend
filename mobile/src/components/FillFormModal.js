import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import api from '../api/client';
import FormModal from './FormModal';
import { Field, Button } from './ui';
import { toast } from './Toast';
import { pickImage } from '../utils/imagePicker';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

/**
 * The KYC form for an Approved party — Admin/Manager approves the party
 * itself, but Admin or Marketing fills this in: owner/Aadhar/PAN photos +
 * numbers, an optional GST number, a comment, and this party's negotiated
 * rate for each product. Saving a complete form unlocks order placement.
 *
 * Cash / Credit and the cheque (number + photo) are NOT here — they are
 * chosen on the order itself, when the order is placed (PlaceOrderScreen).
 *
 * Reused as-is by Admin's "Parties" screen (and Manager's, which reuses
 * that same screen) and by the shared Party Dashboard's detail panel
 * (Admin + Marketing).
 */
export default function FillFormModal({ visible, party, products, onClose, onSaved }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [aadharNo, setAadharNo] = useState('');
    const [panNo, setPanNo] = useState('');
    const [gstNo, setGstNo] = useState('');
    const [comment, setComment] = useState('');
    const [rates, setRates] = useState({});
    const [ownerImage, setOwnerImage] = useState(null);
    const [aadharImage, setAadharImage] = useState(null);
    const [panImage, setPanImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Re-seed every field from the party each time the modal opens, so
    // re-opening it (e.g. to add a missing document) shows what's already
    // saved instead of a blank form.
    useEffect(() => {
        if (!visible || !party) return;
        setAadharNo(party.aadhar_no || '');
        setPanNo(party.pan_no || '');
        setGstNo(party.gst_no || '');
        setComment(party.comment || '');
        const seedRates = {};
        (party.product_rates || []).forEach(r => { seedRates[String(r.product_id)] = String(r.rate); });
        setRates(seedRates);
        setOwnerImage(null);
        setAadharImage(null);
        setPanImage(null);
    }, [visible, party]);

    async function pick(setter) {
        const asset = await pickImage();
        if (asset) setter(asset);
    }

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        const product_rates = Object.entries(rates)
            .filter(([, v]) => v !== '' && Number(v) >= 0)
            .map(([product_id, rate]) => ({ product_id, rate: Number(rate) }));

        if (product_rates.length === 0) {
            toast('Set a rate for at least one product.', 'error');
            return;
        }

        setSubmitting(true);
        const fd = new FormData();
        fd.append('aadhar_no', aadharNo);
        fd.append('pan_no', panNo);
        fd.append('gst_no', gstNo);
        fd.append('comment', comment);
        fd.append('product_rates', JSON.stringify(product_rates));
        if (ownerImage) fd.append('owner_image', { uri: ownerImage.uri, name: 'owner.jpg', type: 'image/jpeg' });
        if (aadharImage) fd.append('aadhar_image', { uri: aadharImage.uri, name: 'aadhar.jpg', type: 'image/jpeg' });
        if (panImage) fd.append('pan_image', { uri: panImage.uri, name: 'pan.jpg', type: 'image/jpeg' });

        const res = await api.post(`/parties/${party.id}/fill-form`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSubmitting(false);
        if (res.data.success) {
            toast(res.data.message || 'Saved.', res.data.fill_form_completed ? 'success' : 'error');
            onSaved?.();
        } else {
            toast(res.data.message || 'Could not save.', 'error');
        }
    }

    const photoLabel = (label, asset, existing) => {
        if (asset) return `🖼️ ${label} — new photo selected`;
        if (existing) return `🖼️ ${label} — replace photo`;
        return `🖼️ Add ${label}`;
    };

    return (
        <FormModal
            visible={visible}
            title={`Fill Form — ${party?.party_name || ''}`}
            onClose={onClose}
            onSubmit={submit}
            submitting={submitting}
            submitLabel="Save Fill Form"
        >
            <Button title={photoLabel('Owner Photo', ownerImage, party?.owner_image)} variant="outline" onPress={() => pick(setOwnerImage)} style={{ marginBottom: spacing.md }} />

            <Field label="Aadhar Number" value={aadharNo} onChangeText={setAadharNo} keyboardType="numeric" />
            <Button title={photoLabel('Aadhar Photo', aadharImage, party?.aadhar_image)} variant="outline" onPress={() => pick(setAadharImage)} style={{ marginBottom: spacing.md }} />

            <Field label="PAN Number" value={panNo} onChangeText={setPanNo} />
            <Button title={photoLabel('PAN Photo', panImage, party?.pan_image)} variant="outline" onPress={() => pick(setPanImage)} style={{ marginBottom: spacing.md }} />

            <Field label="GST Number (optional)" value={gstNo} onChangeText={setGstNo} />
            <Field label="Comment" value={comment} onChangeText={setComment} placeholder="Any note about this party's terms" multiline />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Product Rates for this Party</Text>
            {(products || []).length === 0 ? (
                <Text style={styles.muted}>No products in inventory yet.</Text>
            ) : (
                products.map(p => (
                    <View key={p.id} style={styles.rateRow}>
                        <Text style={styles.rateProductName}>{p.brand_name} — {p.product_name}</Text>
                        <Field
                            value={rates[p.id] || ''}
                            onChangeText={v => setRates(r => ({ ...r, [p.id]: v.replace(/[^0-9.]/g, '') }))}
                            placeholder="₹ Rate"
                            keyboardType="numeric"
                        />
                    </View>
                ))
            )}
        </FormModal>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    muted: { color: colors.textMuted, fontSize: 12.5 },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    rateProductName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
});
