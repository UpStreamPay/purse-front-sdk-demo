import { useState } from 'react';
import { PurseDemo } from './PurseDemo';
import { headlessDemo } from './demos/headless';
import { hostedFormDemo } from './demos/headless/hosted-form';
import { hostedFieldsDemo } from './demos/headless/hosted-fields';
import { dropinDemo } from './demos/dropin';
import { secureFieldsDemo } from './demos/securefields';
import type { DemoConfig } from './demos/types';

const DEMOS: { key: string; label: string; config: DemoConfig }[] = [
    { key: 'headless',       label: 'Headless — Quick start',   config: headlessDemo },
    { key: 'hosted-form',    label: 'Headless — Hosted form',   config: hostedFormDemo },
    { key: 'hosted-fields',  label: 'Headless — Hosted fields', config: hostedFieldsDemo },
    { key: 'dropin',         label: 'Drop-in checkout',          config: dropinDemo },
    { key: 'securefields',   label: 'Secure Fields',             config: secureFieldsDemo },
];

export function App() {
    const [activeKey, setActiveKey] = useState(DEMOS[0].key);
    const demo = DEMOS.find(d => d.key === activeKey)!;

    return (
        <div style={styles.root}>
            <header style={styles.header}>
                <span style={styles.title}>Purse demo preview</span>
                <nav style={styles.nav}>
                    {DEMOS.map(d => (
                        <button
                            key={d.key}
                            onClick={() => setActiveKey(d.key)}
                            style={{ ...styles.tab, ...(d.key === activeKey ? styles.tabActive : {}) }}
                        >
                            {d.label}
                        </button>
                    ))}
                </nav>
            </header>
            <main style={styles.main}>
                <PurseDemo key={activeKey} demo={demo.config} />
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
    },
    tabActive: {
        background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4f46e5', fontWeight: 600,
    },
    main: { padding: 24, maxWidth: 1100, margin: '0 auto' },
};
