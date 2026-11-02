import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

let showFn = null;

/** Call from anywhere: toast('Saved.') or toast('Something failed.', 'error') */
export function toast(message, type = 'success') {
    showFn && showFn(message, type);
}

// Mounted once near the root of App.js. Keeps a tiny queue so rapid
// consecutive calls (e.g. two failed API calls on load) don't overlap.
export default function ToastHost() {
    const [current, setCurrent] = useState(null);
    const queue = useRef([]);
    const opacity = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        showFn = (message, type) => {
            queue.current.push({ message, type, id: Date.now() + Math.random() });
            if (!current) processNext();
        };
        return () => { showFn = null; };
    }, [current]);

    function processNext() {
        const next = queue.current.shift();
        if (!next) return;
        setCurrent(next);
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => {
            setTimeout(() => {
                Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
                    setCurrent(null);
                    processNext();
                });
            }, 2200);
        });
    }

    if (!current) return null;
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.toast,
                { top: insets.top + spacing.sm, opacity, backgroundColor: current.type === 'error' ? colors.danger : colors.brandDark },
            ]}
        >
            <Text style={styles.text}>{current.message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        borderRadius: radius.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        zIndex: 999,
        elevation: 6,
    },
    text: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
