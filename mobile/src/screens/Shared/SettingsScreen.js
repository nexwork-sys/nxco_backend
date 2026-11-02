import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card, Button, SectionTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';

// The one place Dark Mode and Logout live — the last tab in every role's
// navigation, instead of appearing on every single page's header.
export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const { colors, isDark, toggleTheme } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    function confirmLogout() {
        Alert.alert('Log out?', `Signed in as ${user?.name} (${user?.role})`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: logout },
        ]);
    }

    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Settings" />
            <Screen>
                <Card>
                    <SectionTitle>Account</SectionTitle>
                    <Text style={styles.name}>{user?.name}</Text>
                    <Text style={styles.role}>{user?.role} · {user?.employee_id}</Text>
                </Card>

                <Card>
                    <View style={styles.row}>
                        <Text style={styles.label}>🌙 Dark Mode</Text>
                        <Switch value={isDark} onValueChange={toggleTheme} />
                    </View>
                </Card>

                <Button title="Logout" variant="danger" onPress={confirmLogout} />
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    name: { fontSize: 16, fontWeight: '700', color: colors.text },
    role: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 15, fontWeight: '600', color: colors.text },
});
