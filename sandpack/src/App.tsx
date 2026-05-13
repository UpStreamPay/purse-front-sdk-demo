import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { PurseDemo } from './PurseDemo';
import { headlessDemo } from './demos/headless/quick-start';
import { hostedFormDemo } from './demos/headless/hosted-form';
import { hostedFieldsDemo } from './demos/headless/hosted-fields';
import { dropinDemo } from './demos/dropin';
import { secureFieldsDemo } from './demos/securefields';
import type { DemoConfig } from './demos/types';

const DEMOS: { scope: string; usecase: string; label: string; config: DemoConfig }[] = [
    { scope: 'headless',      usecase: 'quick-start',    label: 'Headless — Quick start',   config: headlessDemo },
    { scope: 'headless',      usecase: 'hosted-form',    label: 'Headless — Hosted form',   config: hostedFormDemo },
    { scope: 'headless',      usecase: 'hosted-fields',  label: 'Headless — Hosted fields', config: hostedFieldsDemo },
    { scope: 'dropin',        usecase: 'checkout',       label: 'Drop-in checkout',          config: dropinDemo },
    { scope: 'securefields',  usecase: 'tokenize',       label: 'Secure Fields',             config: secureFieldsDemo },
];

export function App() {
    return (
        <div style={styles.root}>
            <header style={styles.header}>
                <span style={styles.title}>Purse demo preview</span>
                <nav style={styles.nav}>
                    {DEMOS.map(d => (
                        <NavLink
                            key={`${d.scope}/${d.usecase}`}
                            to={`/${d.scope}/${d.usecase}`}
                            style={({ isActive }) => ({
                                ...styles.tab,
                                ...(isActive ? styles.tabActive : {}),
                            })}
                        >
                            {d.label}
                        </NavLink>
                    ))}
                </nav>
            </header>
            <main style={styles.main}>
                <Routes>
                    <Route index element={<Navigate to={`/${DEMOS[0].scope}/${DEMOS[0].usecase}`} replace />} />
                    {DEMOS.map(d => (
                        <Route
                            key={`${d.scope}/${d.usecase}`}
                            path={`/${d.scope}/${d.usecase}`}
                            element={<PurseDemo key={`${d.scope}/${d.usecase}`} demo={d.config} />}
                        />
                    ))}
                </Routes>
            </main>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: { fontFamily: 'sans-serif', minHeight: '100vh', background: '#f9fafb' },
    header: {
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb',
    },
    title: { fontWeight: 600, fontSize: 15, color: '#111827', marginRight: 8, whiteSpace: 'nowrap' },
    nav: { display: 'flex', gap: 4, flexWrap: 'wrap' },
    tab: {
        background: 'none', border: '1px solid transparent', borderRadius: 6,
        padding: '5px 14px', fontSize: 14, cursor: 'pointer', color: '#6b7280',
        textDecoration: 'none',
    },
    tabActive: {
        background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', fontWeight: 600,
    },
    main: { padding: 24, maxWidth: 1100, margin: '0 auto' },
};
