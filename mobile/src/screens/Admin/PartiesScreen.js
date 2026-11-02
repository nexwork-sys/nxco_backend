import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pickImage } from '../../utils/imagePicker';
import api, { mediaUrl } from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, Field, Badge, EmptyState, Loading } from '../../components/ui';
import FormModal from '../../components/FormModal';
import FillFormModal from '../../components/FillFormModal';
import { toast } from '../../components/Toast';
import { getAccurateLocation } from '../../utils/location';
import { spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const VEHICLE_OPTIONS = [
    { key: 'truck', label: 'Truck', icon: '🚛' },
    { key: 'pickup', label: 'Pickup', icon: '🛻' },
    { key: 'magic', label: 'Magic', icon: '🚐' },
    { key: 'auto', label: 'Auto', icon: '🛺' },
    { key: 'toto', label: 'Toto', icon: '🔋🛺' },
];

const emptyForm = {
    party_name: '', owner_name: '', mobile: '', water_brand: '', years_exp: '',
    vehicle_types: [], area: '', city: '', address: '', lat: null, lng: null, image: null,
};

export default function PartiesScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';
    const canManage = ['Admin', 'Manager'].includes(user?.role); // approve/delete
    // Fill Form (KYC + rates) is Admin/Marketing's job — Manager's job ends
    // at approving the party.
    const canFillForm = isAdmin;
    const [parties, setParties] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);

    const [fillFormVisible, setFillFormVisible] = useState(false);
    const [fillFormParty, setFillFormParty] = useState(null);

    const load = useCallback(async () => {
        const [partiesRes, productsRes] = await Promise.all([
            api.get(canManage ? '/parties?status=all' : '/parties'),
            api.get('/products'),
        ]);
        setParties(partiesRes.data.parties || []);
        setProducts(productsRes.data.products || []);
        setLoading(false);
    }, [canManage]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    function openAdd() {
        setEditing(null);
        setForm(emptyForm);
        setModalVisible(true);
    }

    function openEdit(p) {
        setEditing(p);
        setForm({
            party_name: p.party_name, owner_name: p.owner_name, mobile: p.mobile,
            water_brand: p.water_brand || '', years_exp: String(p.years_exp ?? ''),
            vehicle_types: Array.isArray(p.vehicle_types) ? [...p.vehicle_types] : [], area: p.area || '', city: p.city || '',
            address: p.address || '', lat: p.lat, lng: p.lng, image: null,
        });
        setModalVisible(true);
    }

    async function captureLocation() {
        setLocating(true);
        try {
            const loc = await getAccurateLocation();
            setForm(f => ({ ...f, lat: loc.lat, lng: loc.lng }));
            toast('Location captured.');
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLocating(false);
        }
    }

    async function chooseShopPhoto() {
        const asset = await pickImage();
        if (asset) setForm(f => ({ ...f, image: asset }));
    }

    function toggleVehicle(key) {
        setForm(f => ({
            ...f,
            vehicle_types: f.vehicle_types.includes(key)
                ? f.vehicle_types.filter(v => v !== key)
                : [...f.vehicle_types, key],
        }));
    }

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!form.party_name || !form.owner_name || !form.mobile || !form.lat || !form.lng) {
            toast('Party name, owner, mobile, and location are required.', 'error');
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        fd.append('party_name', form.party_name);
        fd.append('owner_name', form.owner_name);
        fd.append('mobile', form.mobile);
        fd.append('water_brand', form.water_brand);
        fd.append('years_exp', form.years_exp || '0');
        fd.append('vehicle_types', form.vehicle_types.join(','));
        fd.append('area', form.area);
        fd.append('city', form.city);
        fd.append('address', form.address);
        fd.append('lat', String(form.lat));
        fd.append('lng', String(form.lng));
        if (form.image) {
            fd.append('shop_image', { uri: form.image.uri, name: 'shop.jpg', type: 'image/jpeg' });
        }

        const url = editing ? `/parties/${editing.id}/update` : '/parties';
        const res = await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSubmitting(false);
        if (res.data.success) {
            toast(editing ? 'Party updated.' : res.data.message || 'Party added.');
            setModalVisible(false);
            load();
        } else {
            toast(res.data.message || 'Could not save party.', 'error');
        }
    }

    async function remove(p) {
        const res = await api.post(`/parties/${p.id}/delete`);
        if (res.data.success) { toast('Party deleted.'); load(); }
        else toast(res.data.message || 'Could not delete.', 'error');
    }

    async function approve(p) {
        const res = await api.post(`/parties/${p.id}/approve`);
        if (res.data.success) { toast('Party approved.'); load(); }
        else toast(res.data.message || 'Could not approve.', 'error');
    }

    function openFillForm(p) {
        setFillFormParty(p);
        setFillFormVisible(true);
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Parties" />
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                <Button title="+ Add Party" onPress={openAdd} style={{ marginBottom: spacing.lg }} />
                {loading ? (
                    <Loading />
                ) : parties.length === 0 ? (
                    <EmptyState text="No parties yet." />
                ) : (
                    parties.map(p => (
                        <Card key={p.id}>
                            <View style={styles.row}>
                                {p.shop_image ? (
                                    <Image source={{ uri: mediaUrl(p.shop_image) }} style={styles.thumb} />
                                ) : (
                                    <View style={[styles.thumb, styles.thumbPlaceholder]}><Text>🏬</Text></View>
                                )}
                                <View style={{ flex: 1, marginLeft: spacing.md }}>
                                    <View style={styles.titleRow}>
                                        <Text style={styles.title}>{p.party_name} {p.truck_icon}</Text>
                                        <Badge status={p.status} />
                                    </View>
                                    <Text style={styles.muted}>{p.owner_name} · {p.mobile}</Text>
                                    <Text style={styles.muted}>{p.area}, {p.city}</Text>
                                    {p.status === 'Approved' && (
                                        <Text style={styles.formStatus}>
                                            {p.fill_form_completed ? '✅ Rate form completed' : '⚠️ Rate form not filled yet'}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.actions}>
                                {p.status === 'Pending' && canManage && (
                                    <Pressable style={styles.actionBtn} onPress={() => approve(p)}>
                                        <Text style={[styles.actionText, { color: colors.brandDark }]}>✅ Approve</Text>
                                    </Pressable>
                                )}
                                {p.status === 'Approved' && canFillForm && (
                                    <Pressable style={styles.actionBtn} onPress={() => openFillForm(p)}>
                                        <Text style={styles.actionText}>📝 Fill Form</Text>
                                    </Pressable>
                                )}
                                <Pressable style={styles.actionBtn} onPress={() => openEdit(p)}><Text style={styles.actionText}>Edit</Text></Pressable>
                                {canManage && (
                                    <Pressable style={styles.actionBtn} onPress={() => remove(p)}>
                                        <Text style={[styles.actionText, { color: colors.danger }]}>
                                            {p.status === 'Pending' ? 'Reject' : 'Delete'}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </Card>
                    ))
                )}
            </Screen>

            <FormModal
                visible={modalVisible}
                title={editing ? 'Edit Party' : 'Add Party'}
                onClose={() => setModalVisible(false)}
                onSubmit={submit}
                submitting={submitting}
                submitLabel={editing ? 'Update Party' : 'Add Party'}
            >
                <Field label="Party / Shop Name" value={form.party_name} onChangeText={v => setForm(f => ({ ...f, party_name: v }))} />
                <Field label="Owner Name" value={form.owner_name} onChangeText={v => setForm(f => ({ ...f, owner_name: v }))} />
                <Field label="Mobile" value={form.mobile} onChangeText={v => setForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" />
                <Field label="Water Brand" value={form.water_brand} onChangeText={v => setForm(f => ({ ...f, water_brand: v }))} />
                <Field label="Years of Experience" value={form.years_exp} onChangeText={v => setForm(f => ({ ...f, years_exp: v }))} keyboardType="numeric" />
                <View style={styles.vehicleSection}>
                    <Text style={styles.label}>Vehicle Access</Text>
                    <View style={styles.vehicleRow}>
                        {VEHICLE_OPTIONS.map(v => {
                            const selected = form.vehicle_types.includes(v.key);
                            return (
                                <Pressable
                                    key={v.key}
                                    onPress={() => toggleVehicle(v.key)}
                                    style={[styles.vehicleBtn, selected && styles.vehicleBtnSelected]}
                                >
                                    <Text style={styles.vehicleIcon}>{v.icon}</Text>
                                    <Text style={[styles.vehicleLabel, selected && styles.vehicleLabelSelected]}>{v.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
                <Field label="Area" value={form.area} onChangeText={v => setForm(f => ({ ...f, area: v }))} />
                <Field label="City" value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} />
                <Field label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline />

                <Button
                    title={form.lat ? `📍 Location captured (${form.lat.toFixed(4)}, ${form.lng.toFixed(4)})` : '📍 Capture Current Location'}
                    variant="outline"
                    onPress={captureLocation}
                    loading={locating}
                    style={{ marginBottom: spacing.md }}
                />
                <Button title={form.image ? '🖼️ Photo selected' : '🖼️ Add Shop Photo'} variant="outline" onPress={chooseShopPhoto} />
            </FormModal>

            <FillFormModal
                visible={fillFormVisible}
                party={fillFormParty}
                products={products}
                onClose={() => setFillFormVisible(false)}
                onSaved={() => { setFillFormVisible(false); load(); }}
            />
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.brandLight },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    formStatus: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    actionBtn: { paddingVertical: 4 },
    actionText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    vehicleSection: { marginBottom: spacing.md },
    vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    vehicleBtn: {
        flexBasis: '23%', alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing.sm, borderRadius: radius.md,
        borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    vehicleBtnSelected: {
        borderColor: colors.brand, backgroundColor: colors.brandLight,
        shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4,
    },
    vehicleIcon: { fontSize: 24 },
    vehicleLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
    vehicleLabelSelected: { color: colors.brandDark, fontWeight: '800' },
    paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    paymentBtn: {
        flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md,
        borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    paymentBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    rateProductName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
});
