import {useEffect, useRef, useState} from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
} from '@codesandbox/sandpack-react';
import type {DemoConfig} from './demos/types';
import styles from './PurseDemo.module.css';

const DEBOUNCE_MS = 2000;

type Props = {
    demo: DemoConfig;
    height?: number | string;
};


export function PurseDemo({demo, height = 720}: Props) {
    const [sessionJson, setSessionJson] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [debouncedDemo, setDebouncedDemo] = useState<DemoConfig>(demo);
    const [configLoading, setConfigLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
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

    useEffect(() => {
        if (demo === debouncedDemo) {
            return;
        }
        setConfigLoading(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            setDebouncedDemo(demo);
            setConfigLoading(false);
        }, DEBOUNCE_MS);
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [demo]);

    const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

    if (error) {
        return <p style={{color: 'red'}}>Session error: {error}</p>;
    }
    if (!sessionJson) {
        return <p>Loading session…</p>;
    }

    return (
        <div className={styles.demo} style={{height: resolvedHeight}}>
            {configLoading && (
                <div className={styles.loader}>
                    <div className={styles.spinner}/>
                    Applying config…
                </div>
            )}
            <SandpackProvider
                template={debouncedDemo.template}
                files={{
                    ...debouncedDemo.files,
                    '/session.json': {code: sessionJson, readOnly: true, hidden: true},
                }}
                customSetup={debouncedDemo.customSetup}
                options={{
                    activeFile: '/index.ts', externalResources: [
                        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
                    ]
                }}
            >
                <SandpackLayout style={{height: '100%'}}>
                    <SandpackCodeEditor style={{height: '100%'}}/>
                    <SandpackPreview style={{
                        height: '100%'
                    }}
                    />
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
}
