import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { pickImage } from '../../utils/imagePicker';
import api, { mediaUrl } from '../../api/client';
import { Screen, Card, Button, Field, SectionTitle } from '../../components/ui';
import { toast } from '../../components/Toast';
import { getAccurateLocation } from '../../utils/location';
import { useAuth } from '../../context/AuthContext';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsScreen() {
    const { colors, isDark, toggleTheme } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { logout } = useAuth();
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [radius, setRadius] = useState('200');
    const [logoPath, setLogoPath] = useState(null);
    const [logoAsset, setLogoAsset] = useState(null);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const load = useCallback(async () => {
        const res = await api.get('/settings');
        const s = res.data.settings || {};
        setLat(String(s.company_lat ?? ''));
        setLng(String(s.company_lng ?? ''));
        setRadius(String(s.allowed_radius_meters ?? 200));
        setLogoPath(s.logo_path || null);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function captureLocation() {
        setLocating(true);
        try {
            const loc = await getAccurateLocation();
            setLat(String(loc.lat));
            setLng(String(loc.lng));
            toast('Current location captured.');
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLocating(false);
        }
    }

    async function saveLocation() {
        setSaving(true);
        const res = await api.post('/settings', { company_lat: lat, company_lng: lng, allowed_radius_meters: radius });
        setSaving(false);
        if (res.data.success) toast('Company location saved.');
        else toast(res.data.message || 'Could not save.', 'error');
    }

    async function pickLogo() {
        const asset = await pickImage({ quality: 0.8 });
        if (asset) setLogoAsset(asset);
    }

    async function uploadLogo() {
        if (!logoAsset) { toast('Choose an image first.', 'error'); return; }
        setUploadingLogo(true);
        const fd = new FormData();
        fd.append('logo_file', { uri: logoAsset.uri, name: 'logo.jpg', type: 'image/jpeg' });
        fd.append('company_lat', lat);
        fd.append('company_lng', lng);
        fd.append('allowed_radius_meters', radius);
        const res = await api.post('/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUploadingLogo(false);
        if (res.data.success) {
            toast('Logo updated.');
            setLogoAsset(null);
            load();
        } else {
            toast(res.data.message || 'Upload failed.', 'error');
        }
    }

    return (
        <Screen>
            <Card>
                <SectionTitle>Office Geofence</SectionTitle>
                <Text style={styles.hint}>Supervisor/Manager/Operator/Driver must check in within this radius of the office.</Text>
                <Field label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
                <Field label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
                <Field label="Allowed Radius (meters)" value={radius} onChangeText={setRadius} keyboardType="numeric" />
                <Button title="📍 Use Current Location" variant="outline" onPress={captureLocation} loading={locating} style={{ marginBottom: spacing.md }} />
                <Button title="Save" onPress={saveLocation} loading={saving} />
            </Card>

            <Card>
                <SectionTitle>Branding — Company Logo</SectionTitle>
                <Text style={styles.hint}>Square image, at least 128×128px, PNG with transparent background works best.</Text>
                <View style={styles.logoRow}>
                    <View style={styles.logoPreview}>
                        {logoPath ? (
                            <Image source={{ uri: mediaUrl(logoPath) }} style={{ width: 56, height: 56 }} resizeMode="contain" />
                        ) : (
                            <Image source={require('../../../assets/icon.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
                        )}
                    </View>
                    <Text style={styles.hint}>Current logo</Text>
                </View>
                <Button title={logoAsset ? '🖼️ New image selected' : '🖼️ Choose Image'} variant="outline" onPress={pickLogo} style={{ marginVertical: spacing.md }} />
                <Button title="Upload Logo" onPress={uploadLogo} loading={uploadingLogo} />
            </Card>

            <Card>
                <View style={styles.row}>
                    <Text style={styles.label}>🌙 Dark Mode</Text>
                    <Switch value={isDark} onValueChange={toggleTheme} />
                </View>
            </Card>

            <Button title="Logout" variant="danger" onPress={logout} />
        </Screen>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    hint: { color: colors.textMuted, fontSize: 12.5, marginBottom: spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 15, fontWeight: '600', color: colors.text },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    logoPreview: {
        width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg,
    },
});
