import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Image, StyleSheet, Easing } from 'react-native';

/**
 * Fade + scale + gentle rise intro, matching the feel of the web app's
 * splash (logo mark settling into place, brand name fading in just after).
 * Shown while AuthContext validates any stored token on launch.
 */
export default function SplashScreen() {
    const scale = useRef(new Animated.Value(0.7)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const subOpacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;
    const companyOpacity = useRef(new Animated.Value(0)).current;
    const companyTranslateY = useRef(new Animated.Value(8)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(subOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            ]),
            // "by Vegnex" — matches the web splash's .splash-sub, which
            // fades/rises in just after the "NXCO" brand name.
            Animated.parallel([
                Animated.timing(companyOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(companyTranslateY, { toValue: 0, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            ]),
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.mark, { opacity, transform: [{ scale }] }]}>
                <Image source={require('../../assets/icon.png')} style={styles.markImage} resizeMode="contain" />
            </Animated.View>
            <Animated.Text style={[styles.brand, { opacity: subOpacity, transform: [{ translateY }] }]}>NXCO</Animated.Text>
            <Animated.Text style={[styles.company, { opacity: companyOpacity, transform: [{ translateY: companyTranslateY }] }]}>
                by Vegnex
            </Animated.Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1F7A' },
    mark: { width: 160, height: 160, borderRadius: 36, overflow: 'hidden', marginBottom: 20 },
    markImage: { width: '100%', height: '100%' },
    brand: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
    company: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
});
