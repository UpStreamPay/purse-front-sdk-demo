import { useEffect, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react';
import type { DemoConfig } from './demos/types';

type Props = {
  demo: DemoConfig;
  height?: number | string;
};

const FILL_STYLES = `
  .purse-demo { position: relative; }
  .purse-demo .sp-wrapper { position: absolute; inset: 0; }
  .purse-demo .sp-layout { height: 100%; min-height: 0 !important; }
  .purse-demo .sp-editor,
  .purse-demo .sp-preview-container { height: 100% !important; min-height: 0 !important; }
  .purse-demo .sp-preview-iframe { height: 100% !important; }
`;

export function PurseDemo({ demo, height = 500 }: Props) {
  const [sessionJson, setSessionJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(process.env.VITE_PURSE_SESSION_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then(data => setSessionJson(JSON.stringify(data, null, 2)))
      .catch(e => setError((e as Error).message));
  }, []);

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height;

  if (error) return <p style={{ color: 'red' }}>Session error: {error}</p>;
  if (!sessionJson) return <p>Loading session…</p>;

  return (
    <div className="purse-demo" style={{ height: resolvedHeight }}>
      <style>{FILL_STYLES}</style>
      <SandpackProvider
        template={demo.template}
        files={{
          ...demo.files,
          '/session.json': { code: sessionJson, readOnly: true, hidden: true },
        }}
        customSetup={demo.customSetup}
      >
        <SandpackLayout style={{ height: '100%' }}>
          <SandpackCodeEditor style={{ height: '100%' }} />
          <SandpackPreview style={{ height: '100%' }} />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
