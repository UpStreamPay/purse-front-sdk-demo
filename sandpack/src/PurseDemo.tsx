import {useEffect, useState} from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
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

    useEffect(() => {
        if (!demo.needsSession){
            return;
        }
        fetch(process.env.VITE_PURSE_SESSION_URL!, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
        })
            .then(r => {
                if (!r.ok) {
                    throw new Error(`${r.status} ${r.statusText}`);
                }
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
                    '/session.json': {code: sessionJson ??"{}", readOnly: true, hidden: true},
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
                <SandpackLayout
                >
                    <SandpackCodeEditor/>
                    <SandpackPreview
                    />
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
}
