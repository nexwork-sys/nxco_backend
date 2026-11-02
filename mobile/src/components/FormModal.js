import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Button } from './ui';
import { radius, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

export default function FormModal({ visible, title, onClose, onSubmit, submitLabel = 'Save', submitting, children }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.sheet}>
                    <Text style={styles.title}>{title}</Text>
                    <ScrollView style={{ maxHeight: '70%' }} keyboardShouldPersistTaps="handled">
                        {children}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                        <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                        <Button
                            title={submitLabel}
                            onPress={submitting ? undefined : onSubmit}
                            loading={submitting}
                            disabled={submitting}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.md,
        borderTopRightRadius: radius.md,
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
});
