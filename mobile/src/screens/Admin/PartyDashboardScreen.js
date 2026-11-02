import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Linking, Pressable, Modal, Image, ScrollView, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, { API_BASE, mediaUrl } from '../../api/client';
import { Screen, Card, Button, Field, EmptyState, Loading } from '../../components/ui';
import AppMap from '../../components/AppMap';
import FormModal from '../../components/FormModal';
import FillFormModal from '../../components/FillFormModal';
import { toast } from '../../components/Toast';
import { mapsSearchUrl } from '../../utils/orders';
import { formatDateStr, formatDateTime, formatMoney } from '../../utils/format';
import { spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// Area -> Parties -> Detail drill-down, matching the field dashboard design:
// tap an area card to see its parties, tap a party to open its full detail
// panel (address, mobile, brand, vehicle access, shop photo, Open in Maps).
// A search box on top can jump straight to matching parties across all areas.
export default function PartyDashboardScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [parties, setParties] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedArea, setSelectedArea] = useState(null);
    const [detailParty, setDetailParty] = useState(null);
    const [revisitVisible, setRevisitVisible] = useState(false);
    const [revisitNote, setRevisitNote] = useState('');
    const [revisitSubmitting, setRevisitSubmitting] = useState(false);
    const [fillFormVisible, setFillFormVisible] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    // party_id -> { billed, collected, due } — how much each party owes,
    // shown as a badge on the list/detail so Admin/Marketing can see at a
    // glance who still has money outstanding.
    const [dues, setDues] = useState({});
    // Payment ledger (driver collections + manual entries) for whichever
    // party's detail panel is currently open.
    const [partyLedger, setPartyLedger] = useState(null);
    const [paymentVisible, setPaymentVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentSubmitting, setPaymentSubmitting] = useState(false);
    const { user } = useAuth();
    const canRevisit = ['Marketing', 'Admin', 'Manager'].includes(user?.role);
    // The Fill Form (KYC + rates) shows here — on the Party Dashboard — for
    // Admin and Marketing specifically, once Manager/Admin has approved
    // the party. Manager already has this same form on their own "Manage
    // Parties" screen.
    const canFillForm = ['Admin', 'Marketing'].includes(user?.role);
    // Who can record a manual payment (money a party pays outside of a
    // driver's delivery — at the office, over UPI, clearing old due).
    const canRecordPayment = ['Admin', 'Marketing', 'Manager'].includes(user?.role);

    const load = useCallback(async () => {
        const [partiesRes, productsRes, duesRes] = await Promise.all([
            api.get('/parties'),
            api.get('/products'),
            api.get('/payments/dues'),
        ]);
        setParties(partiesRes.data.parties || []);
        setProducts(productsRes.data.products || []);
        const dueMap = {};
        (duesRes.data.dues || []).forEach(d => { dueMap[d.party_id] = d; });
        setDues(dueMap);
        setLoading(false);
    }, []);

    const refreshDues = useCallback(async () => {
        const duesRes = await api.get('/payments/dues');
        const dueMap = {};
        (duesRes.data.dues || []).forEach(d => { dueMap[d.party_id] = d; });
        setDues(dueMap);
    }, []);

    // Fetches this party's full payment history whenever its detail panel opens.
    const loadLedger = useCallback(async (partyId) => {
        const res = await api.get(`/payments/party/${partyId}`);
        if (res.data.success) setPartyLedger(res.data);
    }, []);

    function openDetail(party) {
        setDetailParty(party);
        setPartyLedger(null);
        loadLedger(party.id);
    }

    function openPayment() {
        setPaymentAmount('');
        setPaymentMethod('Cash');
        setPaymentNote('');
        setPaymentVisible(true);
    }

    async function submitPayment() {
        if (paymentSubmitting || !detailParty) return; // re-entrancy guard against double-tap
        const amount = Number(paymentAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast('Enter a valid payment amount.', 'error');
            return;
        }
        setPaymentSubmitting(true);
        const res = await api.post('/payments', {
            party_id: detailParty.id,
            amount,
            method: paymentMethod,
            note: paymentNote.trim(),
        });
        setPaymentSubmitting(false);
        if (res.data.success) {
            toast('Payment recorded.');
            setPaymentVisible(false);
            loadLedger(detailParty.id);
            refreshDues();
        } else {
            toast(res.data.message || 'Could not record payment.', 'error');
        }
    }

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

    // Group parties by area with a count per area, sorted by count desc.
    const areas = useMemo(() => {
        const map = {};
        parties.forEach(p => {
            const key = (p.area || 'Unassigned').trim() || 'Unassigned';
            if (!map[key]) map[key] = 0;
            map[key] += 1;
        });
        return Object.entries(map)
            .map(([area, count]) => ({ area, count }))
            .sort((a, b) => b.count - a.count);
    }, [parties]);

    const searching = search.trim().length > 0;

    const searchResults = useMemo(() => {
        if (!searching) return [];
        const q = search.trim().toLowerCase();
        return parties.filter(p => (
            (p.party_name || '').toLowerCase().includes(q) ||
            (p.owner_name || '').toLowerCase().includes(q) ||
            (p.area || '').toLowerCase().includes(q) ||
            (p.city || '').toLowerCase().includes(q) ||
            (p.water_brand || '').toLowerCase().includes(q)
        ));
    }, [parties, search, searching]);

    const areaParties = useMemo(() => {
        if (!selectedArea) return [];
        return parties
            .filter(p => ((p.area || 'Unassigned').trim() || 'Unassigned') === selectedArea)
            .sort((a, b) => (a.party_name || '').localeCompare(b.party_name || ''));
    }, [parties, selectedArea]);

    // Markers follow whatever is currently on screen: search results, the
    // selected area's parties, or every party when browsing the area grid.
    const visibleForMap = searching ? searchResults : (selectedArea ? areaParties : parties);
    const markers = useMemo(
        () => visibleForMap
            .filter(p => p.lat && p.lng)
            .map(p => ({ id: p.id, latitude: p.lat, longitude: p.lng, label: p.party_name, color: colors.brand })),
        [visibleForMap, colors.brand]
    );

    function openArea(area) { setSelectedArea(area); }
    function backToAreas() { setSelectedArea(null); }

    function openRevisit() {
        setRevisitNote('');
        setRevisitVisible(true);
    }

    async function submitRevisit() {
        if (revisitSubmitting) return; // re-entrancy guard against double-tap
        if (!revisitNote.trim()) {
            toast('Enter what happened on this visit.', 'error');
            return;
        }
        setRevisitSubmitting(true);
        const res = await api.post('/visits', { party_id: detailParty.id, note: revisitNote.trim() });
        setRevisitSubmitting(false);
        if (res.data.success) {
            toast('Visit logged.');
            setRevisitVisible(false);
            const partiesRes = await api.get('/parties');
            const fresh = partiesRes.data.parties || [];
            setParties(fresh);
            setDetailParty(fresh.find(p => p.id === detailParty.id) || null);
        } else {
            toast(res.data.message || 'Could not log visit.', 'error');
        }
    }

    // Downloads the server-generated "Party Details" PDF (party info +
    // dashboard photos + Fill Form documents) and opens the native
    // share/save sheet — same streaming-download pattern the order
    // invoice download uses.
    async function downloadPartyPdf() {
        if (downloadingPdf || !detailParty) return; // re-entrancy guard against double-tap
        setDownloadingPdf(true);
        try {
            const token = await AsyncStorage.getItem('nxco_token');
            const fileUri = `${FileSystem.cacheDirectory}party_${detailParty.id}.pdf`;
            const result = await FileSystem.downloadAsync(`${API_BASE}/api/parties/${detailParty.id}/pdf`, fileUri, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (result.status !== 200) {
                toast('Could not generate the PDF.', 'error');
                return;
            }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Party Details' });
            } else {
                toast(`Saved to ${fileUri}`, 'success');
            }
        } catch (e) {
            toast('Could not download the PDF.', 'error');
        } finally {
            setDownloadingPdf(false);
        }
    }

    const listTitle = searching
        ? `Search Results (${searchResults.length})`
        : selectedArea
            ? `${selectedArea} (${areaParties.length})`
            : `Areas (${areas.length})`;

    const shownParties = searching ? searchResults : areaParties;

    return (
        <View style={{ flex: 1 }}>
            {loading ? (
                <Loading />
            ) : (
                <>
                    <AppMap
                        style={styles.map}
                        initialRegion={{ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 15, longitudeDelta: 15 }}
                        markers={markers}
                    />
                    <Screen refreshing={refreshing} onRefresh={onRefresh}>
                        <Field
                            value={search}
                            onChangeText={v => { setSearch(v); if (v.trim()) setSelectedArea(null); }}
                            placeholder="Search area, party, owner or brand…"
                        />

                        {!searching && selectedArea && (
                            <Pressable onPress={backToAreas} style={{ marginBottom: spacing.md }}>
                                <Text style={styles.crumb}>‹ All Areas</Text>
                            </Pressable>
                        )}

                        <Text style={styles.sectionTitle}>{listTitle}</Text>

                        {parties.length === 0 ? (
                            <EmptyState text="No parties yet." />
                        ) : !searching && !selectedArea ? (
                            // ----- Area grid -----
                            <View style={styles.areaGrid}>
                                {areas.map(a => (
                                    <Pressable key={a.area} onPress={() => openArea(a.area)} style={styles.areaCard}>
                                        <Text style={styles.areaIcon}>📍</Text>
                                        <Text style={styles.areaName} numberOfLines={1}>{a.area}</Text>
                                        <View style={styles.areaCountPill}>
                                            <Text style={styles.areaCountText}>{a.count} {a.count === 1 ? 'party' : 'parties'}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        ) : shownParties.length === 0 ? (
                            <EmptyState text="No matching parties." />
                        ) : (
                            // ----- Party list (search results or one area) -----
                            shownParties.map(p => (
                                <Pressable key={p.id} onPress={() => openDetail(p)}>
                                    <Card>
                                        <View style={styles.row}>
                                            <Text style={styles.title}>{p.party_name}</Text>
                                            <Text>{p.truck_icon}</Text>
                                        </View>
                                        {dues[p.id]?.due > 0 && (
                                            <View style={styles.dueBadge}>
                                                <Text style={styles.dueBadgeText}>Due {formatMoney(dues[p.id].due)}</Text>
                                            </View>
                                        )}
                                        <View style={styles.thumbRow}>
                                            {p.shop_image ? (
                                                <Image source={{ uri: mediaUrl(p.shop_image) }} style={styles.thumb} />
                                            ) : (
                                                <View style={[styles.thumb, styles.thumbPlaceholder]}><Text style={styles.thumbEmoji}>🏬</Text></View>
                                            )}
                                            {p.owner_image ? (
                                                <Image source={{ uri: mediaUrl(p.owner_image) }} style={styles.thumb} />
                                            ) : (
                                                <View style={[styles.thumb, styles.thumbPlaceholder]}><Text style={styles.thumbEmoji}>👤</Text></View>
                                            )}
                                        </View>
                                        <Text style={styles.muted}>{p.owner_name} · {p.mobile}</Text>
                                        <Text style={styles.muted}>{p.water_brand}</Text>
                                        <Text style={styles.muted}>{p.area}, {p.city}</Text>
                                    </Card>
                                </Pressable>
                            ))
                        )}
                    </Screen>
                </>
            )}

            {/* ----- Party detail panel ----- */}
            <Modal visible={!!detailParty} animationType="slide" transparent onRequestClose={() => setDetailParty(null)}>
                <View style={styles.backdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetailParty(null)} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {detailParty && (
                                <>
                                    <View style={styles.sheetHeaderRow}>
                                        <Text style={styles.sheetTitle}>{detailParty.party_name}</Text>
                                        <Pressable onPress={() => setDetailParty(null)} hitSlop={10}>
                                            <Text style={styles.closeIcon}>✕</Text>
                                        </Pressable>
                                    </View>
                                    <Text style={styles.sheetVehicles}>{detailParty.truck_icon}</Text>

                                    <Pressable onPress={downloadPartyPdf} style={styles.pdfBtn} disabled={downloadingPdf}>
                                        <Text style={styles.pdfBtnText}>
                                            {downloadingPdf ? 'Preparing…' : '⬇️ Download PDF (Party + Photos)'}
                                        </Text>
                                    </Pressable>

                                    <View style={styles.detailImageRow}>
                                        {detailParty.shop_image ? (
                                            <Image source={{ uri: mediaUrl(detailParty.shop_image) }} style={styles.detailImage} />
                                        ) : (
                                            <View style={[styles.detailImage, styles.detailImagePlaceholder]}>
                                                <Text style={styles.detailImageEmoji}>🏬</Text>
                                                <Text style={styles.detailImageLabel}>Shop</Text>
                                            </View>
                                        )}
                                        {detailParty.owner_image ? (
                                            <Image source={{ uri: mediaUrl(detailParty.owner_image) }} style={styles.detailImage} />
                                        ) : (
                                            <View style={[styles.detailImage, styles.detailImagePlaceholder]}>
                                                <Text style={styles.detailImageEmoji}>👤</Text>
                                                <Text style={styles.detailImageLabel}>Owner</Text>
                                            </View>
                                        )}
                                    </View>

                                    <DetailRow styles={styles} label="Owner" value={detailParty.owner_name} />
                                    <DetailRow styles={styles} label="Mobile" value={detailParty.mobile} />
                                    <DetailRow styles={styles} label="Water Brand" value={detailParty.water_brand || '—'} />
                                    <DetailRow styles={styles} label="Area" value={`${detailParty.area || '—'}, ${detailParty.city || ''}`} />
                                    <DetailRow styles={styles} label="Address" value={detailParty.address || '—'} />

                                    {canFillForm && (
                                        <Pressable onPress={() => setFillFormVisible(true)} style={styles.fillFormBtn}>
                                            <Text style={styles.fillFormBtnText}>
                                                {detailParty.fill_form_completed ? '📝 Edit Fill Form (✅ Completed)' : '📝 Fill Form (⚠️ Not completed)'}
                                            </Text>
                                        </Pressable>
                                    )}

                                    <View style={styles.dueBox}>
                                        <View style={styles.dueBoxRow}>
                                            <View>
                                                <Text style={styles.detailLabel}>Payment Due</Text>
                                                <Text style={[styles.dueAmount, partyLedger?.due > 0 && styles.dueAmountPositive]}>
                                                    {formatMoney(partyLedger?.due ?? 0)}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.dueSubLabel}>Billed {formatMoney(partyLedger?.billed ?? 0)}</Text>
                                                <Text style={styles.dueSubLabel}>Collected {formatMoney(partyLedger?.collected ?? 0)}</Text>
                                            </View>
                                        </View>
                                        {canRecordPayment && (
                                            <Pressable onPress={openPayment} style={styles.recordPaymentBtn}>
                                                <Text style={styles.recordPaymentBtnText}>💰 Record Payment</Text>
                                            </Pressable>
                                        )}
                                        {partyLedger?.payments?.length > 0 && (
                                            <View style={{ marginTop: spacing.md }}>
                                                <Text style={styles.detailLabel}>Recent Payments</Text>
                                                {partyLedger.payments.slice(0, 6).map(pay => (
                                                    <View key={pay.id} style={styles.paymentRow}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.paymentAmount}>
                                                                {formatMoney(pay.amount)} · {pay.method === 'Cash' ? '💵' : '📲'} {pay.method}
                                                            </Text>
                                                            <Text style={styles.paymentMeta}>
                                                                {formatDateTime(pay.created_at)} · {pay.collected_by_name}
                                                                {pay.order_id ? ' · on delivery' : ''}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.visitBox}>
                                        <Text style={styles.detailLabel}>Last Visit</Text>
                                        {detailParty.last_visit ? (
                                            <>
                                                <Text style={styles.visitMeta}>
                                                    {formatDateStr(detailParty.last_visit.date)} · {detailParty.last_visit.visited_by_name || 'Unknown'}
                                                </Text>
                                                <Text style={styles.visitNote}>{detailParty.last_visit.note || 'No note added.'}</Text>
                                            </>
                                        ) : (
                                            <Text style={styles.visitNote}>Not visited yet.</Text>
                                        )}
                                    </View>

                                    {canRevisit && (
                                        <Pressable onPress={openRevisit} style={styles.revisitBtn}>
                                            <Text style={styles.revisitBtnText}>📝 Revisit — Log What Happened</Text>
                                        </Pressable>
                                    )}

                                    {detailParty.lat && detailParty.lng && (
                                        <Pressable
                                            onPress={() => Linking.openURL(mapsSearchUrl(detailParty.lat, detailParty.lng))}
                                            style={styles.mapsBtn}
                                        >
                                            <Text style={styles.mapsBtnText}>📍 Open in Google Maps</Text>
                                        </Pressable>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <FormModal
                visible={revisitVisible}
                title={`Revisit — ${detailParty?.party_name || ''}`}
                onClose={() => setRevisitVisible(false)}
                onSubmit={submitRevisit}
                submitting={revisitSubmitting}
                submitLabel="Save Visit"
            >
                <Field
                    label="What happened on this visit?"
                    value={revisitNote}
                    onChangeText={setRevisitNote}
                    placeholder="e.g. Shop is out of stock, will reorder next week"
                    multiline
                />
            </FormModal>

            <FillFormModal
                visible={fillFormVisible}
                party={detailParty}
                products={products}
                onClose={() => setFillFormVisible(false)}
                onSaved={async () => {
                    setFillFormVisible(false);
                    const partiesRes = await api.get('/parties');
                    const fresh = partiesRes.data.parties || [];
                    setParties(fresh);
                    setDetailParty(fresh.find(p => p.id === detailParty.id) || null);
                }}
            />

            <FormModal
                visible={paymentVisible}
                title={`Record Payment — ${detailParty?.party_name || ''}`}
                onClose={() => setPaymentVisible(false)}
                onSubmit={submitPayment}
                submitting={paymentSubmitting}
                submitLabel="Save Payment"
            >
                <Field
                    label="Amount received (₹)"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    placeholder="e.g. 2000"
                    keyboardType="numeric"
                />
                <Text style={styles.methodLabel}>Payment method</Text>
                <View style={styles.methodRow}>
                    {['Cash', 'Online'].map(m => (
                        <Pressable
                            key={m}
                            onPress={() => setPaymentMethod(m)}
                            style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                        >
                            <Text style={[styles.methodBtnText, paymentMethod === m && styles.methodBtnTextActive]}>
                                {m === 'Cash' ? '💵 Cash' : '📲 Online'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Field
                    label="Note (optional)"
                    value={paymentNote}
                    onChangeText={setPaymentNote}
                    placeholder="e.g. Cleared last month's due"
                />
            </FormModal>
        </View>
    );
}

function DetailRow({ styles, label, value }) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

const makeStyles = (colors) => StyleSheet.create({
    map: { height: 220, width: '100%' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontWeight: '700', fontSize: 15, color: colors.text },
    muted: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
    crumb: { color: colors.brandDark, fontWeight: '700', fontSize: 13.5 },

    areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    areaCard: {
        flexBasis: '47%', backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md,
    },
    areaIcon: { fontSize: 26, marginBottom: 6 },
    areaName: { fontSize: 14.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
    areaCountPill: { marginTop: 8, backgroundColor: colors.brandLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    areaCountText: { fontSize: 11.5, fontWeight: '800', color: colors.brandDark },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md,
        padding: spacing.lg, maxHeight: '85%',
    },
    sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    sheetTitle: { fontSize: 19, fontWeight: '800', color: colors.text, flex: 1, marginRight: spacing.md },
    closeIcon: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
    sheetVehicles: { fontSize: 20, marginTop: 4, marginBottom: spacing.md },
    pdfBtn: {
        backgroundColor: colors.brandLight, borderRadius: radius.sm, paddingVertical: 12,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    },
    pdfBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13.5 },
    detailImageRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    detailImage: { flex: 1, height: 130, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
    detailImagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    detailImageEmoji: { fontSize: 28 },
    detailImageLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: '600' },

    detailRow: { marginBottom: spacing.md },
    detailLabel: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 },
    detailValue: { fontSize: 15, color: colors.text },

    visitBox: {
        backgroundColor: colors.surfaceAlt, borderRadius: radius.sm,
        padding: spacing.md, marginBottom: spacing.md,
    },
    visitMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
    visitNote: { fontSize: 14, color: colors.text, marginTop: 4 },
    revisitBtn: {
        borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.sm,
        paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm,
    },
    revisitBtnText: { color: colors.brandDark, fontWeight: '700', fontSize: 13.5 },
    fillFormBtn: {
        borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm,
        paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm, backgroundColor: colors.surfaceAlt,
    },
    fillFormBtnText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },

    mapsBtn: {
        backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 13,
        alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
    },
    mapsBtnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },

    dueBadge: {
        alignSelf: 'flex-start', backgroundColor: '#fdecec', borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
    },
    dueBadgeText: { fontSize: 11.5, fontWeight: '800', color: '#c0392b' },
    dueBox: {
        backgroundColor: colors.surfaceAlt, borderRadius: radius.sm,
        padding: spacing.md, marginBottom: spacing.md,
    },
    dueBoxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    dueAmount: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
    dueAmountPositive: { color: '#c0392b' },
    dueSubLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
    recordPaymentBtn: {
        backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: 11,
        alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
    },
    recordPaymentBtnText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
    paymentRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
    },
    paymentAmount: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    paymentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

    methodLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
    methodRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    methodBtn: {
        flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm,
        paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surfaceAlt,
    },
    methodBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
    methodBtnText: { fontWeight: '700', color: colors.text, fontSize: 13.5 },
    methodBtnTextActive: { color: colors.brandDark },
});
