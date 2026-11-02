import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../../api/client';
import { Screen, Card, Button, Field, EmptyState, Loading, Badge, SectionTitle } from '../../components/ui';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { todayIST } from '../../utils/format';

// Opening this screen shows just TODAY's attendance by default — not the
// entire history — so Admin/Manager see current, per-day status at a
// glance. Use the date filters (or "Clear") to look up older records.
export default function AttendanceScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState(todayIST());
    const [toDate, setToDate] = useState(todayIST());
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async (filters = {}) => {
        const res = await api.get('/attendance/list', {
            params: {
                search: filters.search ?? search,
                from: filters.from ?? fromDate,
                to: filters.to ?? toDate,
            },
        });
        setRecords(res.data.attendance || []);
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, fromDate, toDate]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    async function applyFilters() {
        setLoading(true);
        await load();
    }

    async function clearFilters() {
        setSearch('');
        setFromDate('');
        setToDate('');
        setLoading(true);
        await load({ search: '', from: '', to: '' });
    }

    function toCsvField(value) {
        const str = value === null || value === undefined ? '' : String(value);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }

    async function downloadCsv() {
        if (exporting) return; // re-entrancy guard against double-tap
        if (records.length === 0) {
            toast('No records to download for the current filters.', 'error');
            return;
        }
        setExporting(true);
        try {
            const header = ['Employee ID', 'Name', 'Role', 'Designation', 'Date', 'Time In', 'Time Out', 'Status', 'Party Visited'];
            const rows = records.map(a => [
                a.employee_id, a.name, a.role, a.designation, a.date,
                a.time_in ?? '', a.time_out ?? '', a.status, a.party_name ?? '',
            ]);
            const csv = [header, ...rows].map(r => r.map(toCsvField).join(',')).join('\n');

            const fileUri = `${FileSystem.cacheDirectory}attendance_${Date.now()}.csv`;
            await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Attendance Report' });
            } else {
                toast(`Saved to ${fileUri}`, 'success');
            }
        } catch (e) {
            toast('Could not generate the report.', 'error');
        } finally {
            setExporting(false);
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <Screen refreshing={refreshing} onRefresh={onRefresh}>
                <Card>
                    <SectionTitle>Filter Attendance</SectionTitle>
                    <Text style={styles.muted}>Showing today's attendance by default. Change the dates or tap "Show All History" for older records.</Text>
                    <View style={{ height: spacing.sm }} />
                    <Field
                        label="Search Employee (name or ID)"
                        value={search}
                        onChangeText={setSearch}
                        placeholder="e.g. Rahul or EMP004"
                    />
                    <View style={styles.dateRow}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                            <Field label="From Date" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                            <Field label="To Date" value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
                        </View>
                    </View>
                    <View style={styles.btnRow}>
                        <Button title="Search" onPress={applyFilters} style={{ flex: 1, marginRight: spacing.sm }} />
                        <Button title="Show All History" variant="outline" onPress={clearFilters} style={{ flex: 1, marginLeft: spacing.sm }} />
                    </View>
                    <Button
                        title={exporting ? 'Preparing…' : '⬇️ Download CSV'}
                        variant="outline"
                        onPress={downloadCsv}
                        loading={exporting}
                        style={{ marginTop: spacing.md }}
                    />
                </Card>

                {loading ? (
                    <Loading />
                ) : records.length === 0 ? (
                    <EmptyState text="No attendance records for these filters." />
                ) : (
                    records.map(a => (
                        <Card key={a.id}>
                            <View style={styles.row}>
                                <Text style={styles.title}>{a.name} <Text style={styles.muted}>({a.role})</Text></Text>
                                <Badge status={a.status} />
                            </View>
                            <Text style={styles.muted}>{a.date} · In {a.time_in ?? '—'} · Out {a.time_out ?? '—'}</Text>
                            {a.party_name && <Text style={styles.muted}>Visited: {a.party_name}</Text>}
                        </Card>
                    ))
                )}
            </Screen>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    dateRow: { flexDirection: 'row' },
    btnRow: { flexDirection: 'row' },
});
