// Palettes copied 1:1 from assets/css/style.css's :root and [data-theme="dark"]
// blocks on the web app, so the mobile app matches exactly in both modes.
export const lightColors = {
    brand: '#10b981',
    brandDark: '#0d9668',
    brandLight: '#d1fae5',
    bg: '#f4faf7',
    surface: '#ffffff',
    surfaceAlt: '#eefcf5',
    border: '#dbe9e2',
    text: '#12241d',
    textMuted: '#5c6b64',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

export const darkColors = {
    ...lightColors,
    bg: '#0e1512',
    surface: '#16201b',
    surfaceAlt: '#1b2820',
    border: '#24352c',
    text: '#eaf5ef',
    textMuted: '#93a89d',
    brandLight: '#123b2c',
};

export const statusColors = {
    Pending: '#f59e0b',
    Confirmed: '#3b82f6',
    'Ready to Dispatch': '#8b5cf6',
    'On the Way': '#0ea5e9',
    Completed: '#10b981',
    Cancelled: '#ef4444',
    Active: '#10b981',
    Inactive: '#94a3b8',
    Visited: '#10b981',
    Approved: '#10b981',
};

export const radius = { md: 12, sm: 8 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

// Static default export kept for any file importing `colors` directly
// (equal to the light palette) — screens should prefer useTheme() from
// ThemeContext so they react to the dark-mode toggle.
export const colors = lightColors;
