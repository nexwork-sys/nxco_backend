import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Linking } from 'react-native';
import { Field, Button } from './ui';
import { mediaUrl } from '../api/client';
import { spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

/**
 * Payment choice for ONE ORDER (moved here from the party's Fill Form):
 *   💵 Cash   — pay now, nothing else needed
 *   🧾 Credit — goods now, money later; needs the cheque number + a cheque photo
 *
 * Controlled component — the screen owns the state:
 *   mode / onModeChange, chequeNo / onChequeNoChange,
 *   chequeImage (a newly picked asset or null), existingChequeImage (URL already saved on the order, if any),
 *   onPickCheque() to open the camera/gallery chooser.
 */
export default function PaymentSection({
    mode, onModeChange, chequeNo, onChequeNoChange, chequeImage, existingChequeImage, onPickCheque,
}) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const chequeLabel = chequeImage
        ? '🖼️ Cheque Photo — new photo selected'
        : existingChequeImage
            ? '🖼️ Cheque Photo — replace photo'
            : '🖼️ Add Cheque Photo';

    return (
        <View>
            <Text style={styles.label}>Payment</Text>
            <View style={styles.row}>
                {['Cash', 'Credit'].map(m => (
                    <Pressable
                        key={m}
                        onPress={() => onModeChange(m)}
                        style={[styles.btn, mode === m && styles.btnSelected]}
                    >
                        <Text style={[styles.btnText, mode === m && styles.btnTextSelected]}>
                            {m === 'Credit' ? '🧾 Credit (mal le, baad mein paisa)' : '💵 Cash'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {mode === 'Credit' && (
                <View style={{ marginTop: spacing.md }}>
                    <Field label="Cheque Number" value={chequeNo} onChangeText={onChequeNoChange} keyboardType="numeric" />
                    <Button title={chequeLabel} variant="outline" onPress={onPickCheque} />
                    {chequeImage ? (
                        <Image source={{ uri: chequeImage.uri }} style={styles.preview} resizeMode="cover" />
                    ) : existingChequeImage ? (
                        <Image source={{ uri: mediaUrl(existingChequeImage) }} style={styles.preview} resizeMode="cover" />
                    ) : null}
                </View>
            )}
        </View>
    );
}

/** Read-only summary of an order's payment choice (plus a tappable cheque thumbnail for Credit orders). */
export function OrderPaymentInfo({ order, showCheque = true }) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    if (!order) return null;

    const isCredit = order.payment_mode === 'Credit';
    return (
        <View style={{ marginTop: 4 }}>
            <Text style={styles.info}>
                {isCredit
                    ? `🧾 Credit (pay later)${order.cheque_no ? ` · Cheque #${order.cheque_no}` : ''}`
                    : '💵 Cash'}
            </Text>
            {showCheque && isCredit && order.cheque_image ? (
                <Pressable onPress={() => Linking.openURL(mediaUrl(order.cheque_image))}>
                    <Image source={{ uri: mediaUrl(order.cheque_image) }} style={styles.thumb} resizeMode="cover" />
                </Pressable>
            ) : null}
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    btn: {
        flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md,
        borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    },
    btnSelected: {
        borderColor: colors.brand, backgroundColor: colors.brandLight,
        shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4,
    },
    btnText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
    btnTextSelected: { color: colors.brandDark, fontWeight: '800' },
    preview: { width: '100%', height: 140, borderRadius: radius.sm, marginTop: spacing.sm },
    info: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    thumb: { width: 96, height: 64, borderRadius: radius.sm, marginTop: 6, borderWidth: 1, borderColor: colors.border },
});
