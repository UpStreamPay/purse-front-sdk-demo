import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { PurseDemo } from './PurseDemo';
import { headlessDemo } from './demos/headless/quick-start';
import { hostedFormDemo } from './demos/headless/hosted-form';
import { hostedFieldsDemo } from './demos/headless/hosted-fields';
import { brandDetectionDemo } from './demos/headless/brand-detection';
import { googlePayDemo } from './demos/headless/google-pay';
import { applePayDemo } from './demos/headless/apple-pay';
import { redirectDemo } from './demos/headless/redirect';
import { installmentsDemo } from './demos/headless/installments';
import { giftCardDemo } from './demos/headless/gift-card';
import { savedTokensDemo } from './demos/headless/saved-tokens';
import { cardRegistrationDemo } from './demos/headless/card-registration';
import { dropinDemo } from './demos/dropin';
import { secureFieldsDemo } from './demos/securefields';
import type { DemoConfig } from './demos/types';

type Demo = {
    scope: string;
    usecase: string;
    label: string;
    config: (dynamicData?: Record<string, any>) => DemoConfig;
};

type Category = {
    key: string;
    label: string;
    badge: string;
    badgeColor: string;
    demos: Demo[];
};

const CATEGORIES: Category[] = [
    {
        key: 'dropin',
        label: 'Drop-in',
        badge: 'Drop-in',
        badgeColor: '#1d4ed8',
        demos: [
            { scope: 'dropin', usecase: 'checkout', label: 'Quick Start', config: dropinDemo },
        ],
    },
    {
        key: 'headless',
        label: 'Headless',
        badge: 'Headless',
        badgeColor: '#6d28d9',
        demos: [
            { scope: 'headless', usecase: 'quick-start',       label: 'Quick Start',       config: headlessDemo },
            { scope: 'headless', usecase: 'hosted-form',        label: 'Hosted Form',        config: hostedFormDemo },
            { scope: 'headless', usecase: 'hosted-fields',      label: 'Hosted Fields',      config: hostedFieldsDemo },
            { scope: 'headless', usecase: 'brand-detection',    label: 'Brand Detection',    config: brandDetectionDemo },
            { scope: 'headless', usecase: 'google-pay',         label: 'Google Pay',         config: googlePayDemo },
            { scope: 'headless', usecase: 'apple-pay',          label: 'Apple Pay',          config: applePayDemo },
            { scope: 'headless', usecase: 'redirect',           label: 'Redirect',           config: redirectDemo },
            { scope: 'headless', usecase: 'installments',       label: 'Installments',       config: installmentsDemo },
            { scope: 'headless', usecase: 'gift-card',          label: 'Gift Card',          config: giftCardDemo },
            { scope: 'headless', usecase: 'saved-tokens',       label: 'Saved Tokens',       config: savedTokensDemo },
            { scope: 'headless', usecase: 'card-registration',  label: 'Card Registration',  config: cardRegistrationDemo },
        ],
    },
    {
        key: 'securefields',
        label: 'Secure Fields',
        badge: 'SecureFields',
        badgeColor: '#be185d',
        demos: [
            { scope: 'securefields', usecase: 'tokenize', label: 'Tokenize', config: secureFieldsDemo },
        ],
    },
];

const ALL_DEMOS = CATEGORIES.flatMap(c => c.demos);

export function App() {
    return (
        <div style={styles.root}>
            {/* Sidebar */}
            <aside style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <span style={styles.logo}>Purse SDK</span>
                    <span style={styles.logoSub}>Demo Preview</span>
                </div>
                <nav style={styles.nav}>
                    {CATEGORIES.map(cat => (
                        <div key={cat.key} style={styles.navGroup}>
                            <div style={{ ...styles.navGroupLabel, color: cat.badgeColor }}>
                                {cat.label}
                            </div>
                            {cat.demos.map(d => (
                                <NavLink
                                    key={`${d.scope}/${d.usecase}`}
                                    to={`/${d.scope}/${d.usecase}`}
                                    style={({ isActive }) => ({
                                        ...styles.navItem,
                                        ...(isActive ? styles.navItemActive : {}),
                                    })}
                                >
                                    {d.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main content */}
            <main style={styles.main}>
                <Routes>
                    <Route index element={<Navigate to={`/${ALL_DEMOS[0].scope}/${ALL_DEMOS[0].usecase}`} replace />} />
                    {ALL_DEMOS.map(d => (
                        <Route
                            key={`${d.scope}/${d.usecase}`}
                            path={`/${d.scope}/${d.usecase}`}
                            element={<PurseDemo key={`${d.scope}/${d.usecase}`} demo={d.config()} />}
                        />
                    ))}
                </Routes>
            </main>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex',
        minHeight: '100vh',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: '#f9fafb',
    },
    sidebar: {
        width: 220,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
    },
    sidebarHeader: {
        padding: '20px 16px 16px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    logo: {
        fontSize: 15,
        fontWeight: 700,
        color: '#111827',
        letterSpacing: '-0.01em',
    },
    logoSub: {
        fontSize: 11,
        fontWeight: 500,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
    },
    nav: {
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    navGroup: {
        marginBottom: 12,
    },
    navGroupLabel: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        padding: '4px 8px 6px',
    },
    navItem: {
        display: 'block',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 13,
        color: '#374151',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'background 0.1s',
    },
    navItemActive: {
        background: '#eef2ff',
        color: '#4f46e5',
        fontWeight: 600,
    },
    main: {
        flex: 1,
        padding: 24,
        minWidth: 0,
    },
};
