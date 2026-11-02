import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, Field, SectionTitle, Badge, EmptyState } from '../../components/ui';
import { toast } from '../../components/Toast';
import { getAccurateLocation } from '../../utils/location';
import { pickImage } from '../../utils/imagePicker';
import { spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

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

export default function AddPartyScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [form, setForm] = useState(emptyForm);
    const [locating, setLocating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [myParties, setMyParties] = useState([]);

    const loadMyParties = useCallback(async () => {
        const res = await api.get('/parties?mine=1');
        setMyParties(res.data.parties || []);
    }, []);

    useFocusEffect(useCallback(() => { loadMyParties(); }, [loadMyParties]));

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
        if (!form.party_name || !form.owner_name || !form.mobile) {
            toast('Party name, owner, and mobile are required.', 'error');
            return;
        }
        if (!form.lat || !form.lng) {
            toast('Capture the shop\'s location before saving — it\'s needed for attendance and delivery.', 'error');
            return;
        }
        setSubmitting(true);
        const fd = new FormData();
        Object.entries({
            party_name: form.party_name, owner_name: form.owner_name, mobile: form.mobile,
            water_brand: form.water_brand, years_exp: form.years_exp || '0',
            vehicle_types: form.vehicle_types.join(','), area: form.area, city: form.city,
            address: form.address, lat: String(form.lat), lng: String(form.lng),
        }).forEach(([k, v]) => fd.append(k, v));
        if (form.image) {
            fd.append('shop_image', { uri: form.image.uri, name: 'shop.jpg', type: 'image/jpeg' });
        }

        const res = await api.post('/parties', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSubmitting(false);
        if (res.data.success) {
            toast(res.data.message || 'Party added.');
            setForm(emptyForm);
            loadMyParties();
        } else {
            toast(res.data.message || 'Could not add party.', 'error');
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Add Party" />
            <Screen>
                <Card>
                    <SectionTitle>New Shop / Party Details</SectionTitle>
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
                        title={form.lat ? `📍 Location captured` : '📍 Capture Current Location (required)'}
                        variant="outline"
                        onPress={captureLocation}
                        loading={locating}
                        style={{ marginBottom: spacing.md }}
                    />
                    <Button
                        title={form.image ? '🖼️ Photo selected' : '🖼️ Add Shop Photo'}
                        variant="outline"
                        onPress={chooseShopPhoto}
                        style={{ marginBottom: spacing.md }}
                    />
                    <Button title="Save Party" onPress={submit} loading={submitting} />
                </Card>

                <Card>
                    <SectionTitle>My Added Parties</SectionTitle>
                    {myParties.length === 0 ? (
                        <EmptyState text="You haven't added any parties yet." />
                    ) : (
                        myParties.map(p => (
                            <View key={p.id} style={styles.myPartyRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.myPartyName}>{p.party_name}</Text>
                                    <Text style={styles.myPartyMeta}>{p.owner_name} · {p.area || p.city || '—'}</Text>
                                    {p.status === 'Pending' && (
                                        <Text style={styles.myPartyHint}>Waiting for Admin/Manager approval</Text>
                                    )}
                                </View>
                                <Badge status={p.status} />
                            </View>
                        ))
                    )}
                </Card>
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
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
    myPartyRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    myPartyName: { fontWeight: '700', fontSize: 14, color: colors.text },
    myPartyMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    myPartyHint: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
});
