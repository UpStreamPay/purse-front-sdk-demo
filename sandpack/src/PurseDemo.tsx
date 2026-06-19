import {useEffect, useState} from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackConsole,
} from '@codesandbox/sandpack-react';
import type {DemoConfig} from './demos/types';
import INLINE_STYLES from './PurseDemo.module.css?raw'

type Props = {
    demo: DemoConfig;
    height?: number | string;
};

export function PurseDemo({demo, height = 720}: Props) {
    const [sessionJson, setSessionJson] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showConsole, setShowConsole] = useState(false);

    useEffect(() => {
        if (!demo.needsSession) {
            return;
        }
        const orderUrl = process.env.VITE_PURSE_ORDER_URL!;
        const sessionUrl = process.env.VITE_PURSE_SESSION_URL!;

        fetch(orderUrl)
            .then(r => {
                if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
                return r.json();
            })
            .then(({order}) => {
                if (demo.redirectionUrl) {
                    order.order.redirection = demo.redirectionUrl;
                }
                return fetch(sessionUrl, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(order),
                });
            })
            .then(r => {
                if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
                return r.json();
            })
            .then(data => setSessionJson(JSON.stringify(data, null, 2)))
            .catch(e => setError((e as Error).message));
    }, []);

    const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

    if (error) {
        return <p style={{color: 'red'}}>Session error: {error}</p>;
    }
    if (demo.needsSession && !sessionJson) {
        return <p>Loading session…</p>;
    }

    return (
        <div className="purse-demo" style={{height: resolvedHeight}}>
            <style>{INLINE_STYLES}</style>
            <SandpackProvider
                template={demo.template}
                files={{
                    ...demo.files,
                    '/session.json': {code: sessionJson ?? "{}", readOnly: true, hidden: true},
                }}
                customSetup={demo.customSetup}
                options={{
                    recompileDelay: 750,
                    recompileMode: "delayed",
                    activeFile: '/index.ts', externalResources: [
                        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
                    ]
                }}
            >
                <SandpackLayout style={{flexDirection: 'column'}}>
                    <div style={{display: 'flex', flex: 1, minHeight: 0}}>
                        <SandpackCodeEditor style={{flex: '1 1 50%', minWidth: 0}} wrapContent/>
                        <SandpackPreview style={{flex: '1 1 50%', minWidth: 0}}/>
                    </div>
                    <div style={{borderTop: '1px solid var(--sp-colors-surface2)'}}>
                        <button
                            onClick={() => setShowConsole(v => !v)}
                            style={{
                                width: '100%',
                                padding: '6px 12px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                background: 'var(--sp-colors-surface1)',
                                color: 'var(--sp-colors-fg-default)',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {showConsole ? '▾' : '▸'} Console
                        </button>
                        {showConsole && (
                            <SandpackConsole style={{height: 160}}/>
                        )}
                    </div>
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
}
