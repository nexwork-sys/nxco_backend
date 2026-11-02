import React from 'react';
import { View } from 'react-native';
import DashboardHeader from '../../components/DashboardHeader';
import ProductsScreen from '../Admin/ProductsScreen';

// Supervisor/Manager/Operator manage the same product inventory Admin does
// (same permissions on the backend) — reuse the screen as-is, just under
// this dashboard's own header.
export default function InventoryScreen() {
    return (
        <View style={{ flex: 1 }}>
            <DashboardHeader title="Product Inventory" />
            <ProductsScreen />
        </View>
    );
}
