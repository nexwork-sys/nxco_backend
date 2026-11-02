import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Set the real machine/LAN IP or deployed API URL here (or override via
// app.json > expo.extra.apiBaseUrl) — "localhost" only works on an iOS
// simulator, not a real phone or Android emulator.
export const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:4000';

const client = axios.create({ baseURL: `${API_BASE}/api`, timeout: 20000 });

client.interceptors.request.use(async config => {
    const token = await AsyncStorage.getItem('nxco_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Every backend response is { success, message, ...data } even on failure
// (4xx/5xx) — normalize so callers can just `await api.get(...)` and check
// `.data.success` without a try/catch around every single call.
client.interceptors.response.use(
    res => res,
    err => {
        if (err.response) return Promise.resolve(err.response);
        return Promise.reject(err);
    }
);

export default client;

/**
 * Images are stored on Cloudinary, so the API returns full https URLs — use them as-is.
 * (A relative `uploads/...` path from older data is still resolved against the API.)
 */
export function mediaUrl(pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${API_BASE}/${pathOrUrl}`;
}
