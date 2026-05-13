import { useState } from 'react';
import { ENV_KEYS, type EnvKey, getEnv, setEnv, resetEnv, resetAllEnv, isOverridden, getBuildDefault } from './env';

const LABELS: Record<EnvKey, string> = {
    VITE_PURSE_SECUREFIELDS_TENANT_ID: 'Tenant ID',
    VITE_PURSE_API_KEY: 'API Key',
};

const HINTS: Record<EnvKey, string> = {
    VITE_PURSE_SECUREFIELDS_TENANT_ID: 'for Secure Fields',
    VITE_PURSE_API_KEY: 'for Secure Fields',
};

function EnvRow({ envKey, onUpdate }: { envKey: EnvKey; onUpdate: () => void }) {
    const [value, setValue] = useState(() => getEnv(envKey));
    const [overridden, setOverridden] = useState(() => isOverridden(envKey));
    const def = getBuildDefault(envKey);

    const handleChange = (v: string) => {
        setValue(v);
        setEnv(envKey, v);
        setOverridden(isOverridden(envKey));
        onUpdate();
    };

    const handleReset = () => {
        resetEnv(envKey);
        setValue(getBuildDefault(envKey));
        setOverridden(false);
        onUpdate();
    };

    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-800">{LABELS[envKey]}</span>
                <div className="flex items-center gap-1.5">
                    <span className={overridden
                        ? 'text-xs px-1.5 py-px bg-violet-100 text-violet-700 rounded-full font-medium'
                        : 'text-xs px-1.5 py-px bg-gray-100 border border-gray-200 text-gray-500 rounded-full'
                    }>
                        {overridden ? 'local' : 'env'}
                    </span>
                    {overridden && (
                        <button
                            className="text-xs text-red-500 hover:underline cursor-pointer bg-transparent border-0 font-[inherit] p-0 leading-none"
                            title="Reset to .env value"
                            onClick={handleReset}
                        >
                            ↺
                        </button>
                    )}
                </div>
            </div>
            <input
                type="text"
                className="w-full text-xs font-mono border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400 block"
                placeholder={HINTS[envKey]}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
            />
            {def && (
                <div className="text-xs text-gray-400 mt-1 truncate" title={def}>
                    default: <span className="font-mono">{def.length > 32 ? def.slice(0, 32) + '…' : def}</span>
                </div>
            )}
        </div>
    );
}

export function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [, forceUpdate] = useState(0);

    const handleReset = () => {
        resetAllEnv();
        forceUpdate(n => n + 1);
    };

    return (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {open && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                        <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Debug Config</span>
                        <div className="flex items-center gap-2">
                            <button
                                className="text-xs text-red-500 hover:underline cursor-pointer bg-transparent border-0 font-[inherit] p-0"
                                onClick={handleReset}
                            >
                                Reset all
                            </button>
                            <button
                                className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-full cursor-pointer border-0 font-[inherit] hover:bg-indigo-700 transition-colors"
                                onClick={() => location.reload()}
                            >
                                ⟳ Reload
                            </button>
                            <button
                                className="text-gray-400 hover:text-gray-700 cursor-pointer bg-transparent border-0 font-[inherit] text-base leading-none p-0"
                                onClick={() => setOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {ENV_KEYS.map(k => (
                            <EnvRow key={k} envKey={k} onUpdate={() => forceUpdate(n => n + 1)} />
                        ))}
                    </div>
                </div>
            )}
            <button
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-all"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
                onClick={() => setOpen(o => !o)}
            >
                ⚙ Config
            </button>
        </div>
    );
}
