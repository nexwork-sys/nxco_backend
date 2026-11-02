import AdminPartiesScreen from '../Admin/PartiesScreen';

// Manager gets the same full party-management screen Admin uses — approve
// Pending parties, fill in the KYC/rate form, edit, delete. Reused as-is;
// it already has its own embedded header (it's a root tab on Admin's side
// too, not a MoreStack screen), so this wrapper doesn't add a second one.
export default AdminPartiesScreen;
