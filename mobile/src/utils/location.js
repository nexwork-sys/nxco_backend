import * as Location from 'expo-location';

/**
 * Same idea as the web app's NXCO.getLocation(): a single getCurrentPosition
 * often returns a coarse network-based fix before GPS locks on. Watch for up
 * to ~12s and keep the most accurate reading, resolving early once accuracy
 * is good enough.
 */
export async function getAccurateLocation({ timeoutMs = 12000, desiredAccuracyM = 30 } = {}) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Location permission denied. Enable it in Settings to use attendance and tracking.');
    }

    return new Promise((resolve, reject) => {
        let best = null;
        let settled = false;
        let subscription = null;

        const finish = () => {
            if (settled) return;
            settled = true;
            subscription && subscription.remove();
            if (best) resolve(best);
            else reject(new Error('Could not get your location. Enable GPS and try again in an open area.'));
        };

        const timer = setTimeout(finish, timeoutMs);

        Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
            pos => {
                const reading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 999 };
                if (!best || reading.accuracy < best.accuracy) best = reading;
                if (reading.accuracy <= desiredAccuracyM) {
                    clearTimeout(timer);
                    finish();
                }
            }
        ).then(sub => {
            subscription = sub;
            if (settled) sub.remove();
        });
    });
}
