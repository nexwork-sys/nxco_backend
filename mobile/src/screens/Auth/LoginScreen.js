import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Field, Button, Footer } from '../../components/ui';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const insets = useSafeAreaInsets();
    const { login } = useAuth();
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (loading) return; // re-entrancy guard: ignore rapid double-taps
        if (!employeeId || !password) {
            toast('Enter your Employee ID and password.', 'error');
            return;
        }
        setLoading(true);
        try {
            const data = await login(employeeId.trim(), password);
            if (!data.success) toast(data.message || 'Login failed.', 'error');
        } catch {
            toast('Could not reach the server. Check your connection.', 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.center}>
                <View style={styles.brand}>
                    <View style={styles.mark}>
                        <Image source={require('../../../assets/icon.png')} style={styles.markImage} resizeMode="contain" />
                    </View>
                    <Text style={styles.name}>NXCO</Text>
                    <Text style={styles.company}>by Vegnex</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.heading}>Sign in</Text>
                    <Field label="Employee ID" value={employeeId} onChangeText={setEmployeeId} placeholder="e.g. admin" />
                    <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
                    <Button title="Log In" onPress={handleLogin} loading={loading} disabled={loading} style={{ marginTop: spacing.sm }} />
                </View>
            </View>
            <Footer variant="light" />
        </KeyboardAvoidingView>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.brand, padding: spacing.xl, justifyContent: 'space-between' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    brand: { alignItems: 'center', marginBottom: spacing.xxl },
    mark: {
        width: 96, height: 96, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0F1F7A',
        marginBottom: spacing.md,
    },
    markImage: { width: '100%', height: '100%' },
    name: { fontSize: 24, fontWeight: '800', color: '#fff' },
    company: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.xl },
    heading: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
});
