import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { radius, spacing, statusColors } from '../theme';
import { useTheme } from '../context/ThemeContext';

// Fixed footer shown at the bottom of every screen's scroll content.
// Rendered inline (not position:absolute) so it never overlaps content on
// short screens, but always appears after everything else scrolls past.
export function Footer({ variant = 'default' }) {
    const { colors } = useTheme();
    const color = variant === 'light' ? 'rgba(255,255,255,0.85)' : colors.textMuted;
    return (
        <View style={{ paddingTop: spacing.xl, paddingBottom: spacing.sm, alignItems: 'center' }}>
            <Text style={{ color, fontSize: 11.5 }}>Designed &amp; Developed by Nexwork Tech</Text>
        </View>
    );
}

export function Screen({ children, scroll = true, refreshing, onRefresh, style, showFooter = true }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (!scroll) {
        return (
            <View style={[styles.screen, style]}>
                {children}
                {showFooter && <Footer />}
            </View>
        );
    }
    return (
        <ScrollView
            style={[styles.screen, style]}
            contentContainerStyle={styles.screenContent}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
            {children}
            {showFooter && <Footer />}
        </ScrollView>
    );
}

export function Card({ children, style }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Button({ title, onPress, variant = 'solid', loading, disabled, style }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const isOutline = variant === 'outline';
    const isDanger = variant === 'danger';
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.btn,
                isOutline && styles.btnOutline,
                isDanger && styles.btnDanger,
                (disabled || loading) && { opacity: 0.6 },
                pressed && { opacity: 0.85 },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isOutline ? colors.brandDark : '#fff'} />
            ) : (
                <Text style={[styles.btnText, isOutline && styles.btnTextOutline]}>{title}</Text>
            )}
        </Pressable>
    );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, editable = true, multiline }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={{ marginBottom: spacing.md }}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <TextInput
                style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }, !editable && { opacity: 0.6 }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
                editable={editable}
                multiline={multiline}
                autoCapitalize="none"
            />
        </View>
    );
}

export function Badge({ status }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const color = statusColors[status] || colors.textMuted;
    return (
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{status}</Text>
        </View>
    );
}

export function StatCard({ label, value }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <Card style={{ flex: 1, alignItems: 'center', minWidth: '46%' }}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </Card>
    );
}

export function EmptyState({ text }) {
    const { colors } = useTheme();
    return (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted }}>{text}</Text>
        </View>
    );
}

export function Loading() {
    const { colors } = useTheme();
    return (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
    btn: {
        backgroundColor: colors.brand,
        borderRadius: radius.sm,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.brand },
    btnDanger: { backgroundColor: colors.danger },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
    btnTextOutline: { color: colors.brandDark },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    badgeText: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase' },
    statValue: { fontSize: 26, fontWeight: '800', color: colors.brandDark },
    statLabel: { fontSize: 12.5, color: colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
});
