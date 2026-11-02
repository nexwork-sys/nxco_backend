import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import { Screen, Card } from '../../components/ui';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const ITEMS = [
    { label: 'Employees', emoji: '👥', screen: 'Employees' },
    { label: 'Product Inventory', emoji: '📦', screen: 'Products' },
    { label: 'Party Dashboard', emoji: '🗺️', screen: 'PartyDashboard' },
    { label: 'Plan Visits (PJP)', emoji: '🗓️', screen: 'PJP' },
    { label: 'Marketing Targets', emoji: '🎯', screen: 'Targets' },
    { label: 'Attendance', emoji: '🕒', screen: 'Attendance' },
    { label: 'Settings', emoji: '⚙️', screen: 'Settings' },
];

export default function MoreScreen({ navigation }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="More" />
            <Screen>
                {ITEMS.map(item => (
                    <Pressable key={item.screen} onPress={() => navigation.navigate(item.screen)}>
                        <Card style={styles.row}>
                            <Text style={styles.emoji}>{item.emoji}</Text>
                            <Text style={styles.label}>{item.label}</Text>
                            <Text style={styles.chevron}>›</Text>
                        </Card>
                    </Pressable>
                ))}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    emoji: { fontSize: 20, marginRight: spacing.md },
    label: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.text },
    chevron: { fontSize: 22, color: colors.textMuted },
});
