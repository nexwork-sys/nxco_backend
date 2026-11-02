import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { Screen, Card, Button, Field, EmptyState, Loading, Badge } from '../../components/ui';
import FormModal from '../../components/FormModal';
import { toast } from '../../components/Toast';
import { spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const ROLES = ['Admin', 'Marketing', 'Supervisor', 'Manager', 'Operator', 'Driver'];
const emptyForm = { employee_id: '', name: '', mobile: '', designation: '', role: 'Marketing', password: '' };

export default function EmployeesScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        const res = await api.get('/employees');
        setEmployees(res.data.employees || []);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    function openAdd() { setEditing(null); setForm(emptyForm); setModalVisible(true); }
    function openEdit(e) {
        setEditing(e);
        setForm({ employee_id: e.employee_id, name: e.name, mobile: e.mobile, designation: e.designation, role: e.role, password: '' });
        setModalVisible(true);
    }

    async function submit() {
        if (submitting) return; // re-entrancy guard against double-tap
        if (!form.employee_id || !form.name || !form.mobile || !form.designation || (!editing && !form.password)) {
            toast('Fill in all required fields.', 'error');
            return;
        }
        setSubmitting(true);
        const url = editing ? `/employees/${editing.id}/update` : '/employees';
        const payload = editing ? { ...form, employee_id: undefined } : form;
        const res = await api.post(url, payload);
        setSubmitting(false);
        if (res.data.success) {
            toast(editing ? 'Employee updated.' : 'Employee created.');
            setModalVisible(false);
            load();
        } else {
            toast(res.data.message || 'Could not save employee.', 'error');
        }
    }

    async function remove(e) {
        const res = await api.post(`/employees/${e.id}/delete`);
        if (res.data.success) { toast('Employee deleted.'); load(); }
        else toast(res.data.message || 'Could not delete.', 'error');
    }

    return (
        <View style={{ flex: 1 }}>
            <Screen>
                <Button title="+ Add Employee" onPress={openAdd} style={{ marginBottom: spacing.lg }} />
                {loading ? (
                    <Loading />
                ) : employees.length === 0 ? (
                    <EmptyState text="No employees yet." />
                ) : (
                    employees.map(e => (
                        <Card key={e.id}>
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.title}>{e.name}</Text>
                                    <Text style={styles.muted}>{e.employee_id} · {e.designation} · {e.mobile}</Text>
                                </View>
                                <Badge status={e.role} />
                            </View>
                            <View style={styles.actions}>
                                <Pressable onPress={() => openEdit(e)}><Text style={styles.actionText}>Edit</Text></Pressable>
                                {e.employee_id !== 'admin' && (
                                    <Pressable onPress={() => remove(e)}><Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text></Pressable>
                                )}
                            </View>
                        </Card>
                    ))
                )}
            </Screen>

            <FormModal
                visible={modalVisible}
                title={editing ? 'Edit Employee' : 'Add Employee'}
                onClose={() => setModalVisible(false)}
                onSubmit={submit}
                submitting={submitting}
                submitLabel={editing ? 'Update' : 'Add'}
            >
                <Field label="Employee ID" value={form.employee_id} onChangeText={v => setForm(f => ({ ...f, employee_id: v }))} editable={!editing} />
                <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
                <Field label="Mobile" value={form.mobile} onChangeText={v => setForm(f => ({ ...f, mobile: v }))} keyboardType="phone-pad" />
                <Field label="Designation" value={form.designation} onChangeText={v => setForm(f => ({ ...f, designation: v }))} />
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleRow}>
                    {ROLES.map(r => (
                        <Pressable key={r} onPress={() => setForm(f => ({ ...f, role: r }))} style={[styles.roleChip, form.role === r && styles.roleChipActive]}>
                            <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextActive]}>{r}</Text>
                        </Pressable>
                    ))}
                </View>
                <Field
                    label={editing ? 'New Password (leave blank to keep current)' : 'Password'}
                    value={form.password}
                    onChangeText={v => setForm(f => ({ ...f, password: v }))}
                    secureTextEntry
                />
            </FormModal>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
    actionText: { color: colors.brandDark, fontWeight: '700', fontSize: 13 },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
    roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    roleChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    roleChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    roleChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    roleChipTextActive: { color: '#fff' },
});
