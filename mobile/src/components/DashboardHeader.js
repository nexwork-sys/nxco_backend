import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

// Title-only bar shown at the top of every dashboard screen. Dark Mode and
// Logout used to live here (so they showed up on every single page) — they
// now live only on the Settings screen (the last page in each role's
// navigation), so this header just displays the screen title.
export default function DashboardHeader({ title }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        // paddingTop uses the device's safe-area inset (status bar / notch
        // height) instead of a fixed number, so the header never gets
        // pushed under the status bar on any phone.
        <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
            <Text style={styles.title}>{title}</Text>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    bar: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: { fontSize: 19, fontWeight: '800', color: colors.text },
});
