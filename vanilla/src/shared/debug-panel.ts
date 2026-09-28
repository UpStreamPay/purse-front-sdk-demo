import {ENV_KEYS, type EnvKey, getEnv, setEnv, resetEnv, resetForKeys, isOverridden, getBuildDefault} from './env';
import {t, type MessageKey} from '../i18n';

const LABELS: Record<EnvKey, MessageKey> = {
    VITE_PURSE_ENVIRONMENT: 'panel.label.environment',
    VITE_PURSE_SESSION_JSON: 'panel.label.session',
    VITE_PURSE_SECUREFIELDS_TENANT_ID: 'panel.label.tenant',
    VITE_PURSE_API_KEY: 'panel.label.apiKey',
    VITE_PURSE_ENTITY_ID: 'panel.label.entity',
    VITE_PURSE_PROXY_URL: 'common.proxyUrl',
};

const HINTS: Record<EnvKey, MessageKey> = {
    VITE_PURSE_ENVIRONMENT: 'panel.hint.environment',
    VITE_PURSE_SESSION_JSON: 'panel.hint.session',
    VITE_PURSE_SECUREFIELDS_TENANT_ID: 'panel.hint.secureFields',
    VITE_PURSE_API_KEY: 'panel.hint.secureFields',
    VITE_PURSE_ENTITY_ID: 'panel.hint.entity',
    VITE_PURSE_PROXY_URL: 'panel.hint.proxy',
};

// Never echoed on the page, even as a default.
const SECRET_KEYS: ReadonlySet<EnvKey> = new Set(['VITE_PURSE_API_KEY', 'VITE_PURSE_SESSION_JSON']);

/**
 * With nothing overridden, the demo runs on build defaults the reader never set
 * — say which, so "where is this talking to?" has an answer on the page itself.
 */
function mountDefaultsBanner(keys: readonly EnvKey[], openPanel: () => void) {
    if (keys.some(isOverridden)) {
        return;
    }
    const values = keys
        .filter(k => !SECRET_KEYS.has(k) && getEnv(k))
        .map(k => t('banner.value', {label: t(LABELS[k]), value: getEnv(k)}));
    if (values.length === 0) {
        return;
    }
    const createsSession =
        keys.includes('VITE_PURSE_SESSION_JSON') && !getEnv('VITE_PURSE_SESSION_JSON') && getEnv('VITE_PURSE_PROXY_URL');

    const banner = document.createElement('div');
    banner.className =
        'flex gap-3 px-4 py-3.5 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-900 mb-6';

    const text = document.createElement('div');
    text.className = 'min-w-0';
    const title = document.createElement('div');
    title.className = 'font-semibold';
    title.textContent = t('banner.title');
    const detail = document.createElement('div');
    detail.className = 'text-xs mt-1 break-words';
    detail.textContent =
        values.join(' · ') + (createsSession ? t('banner.proxySession') : '');

    const override = document.createElement('button');
    override.className =
        'text-xs font-semibold underline underline-offset-2 mt-1.5 cursor-pointer bg-transparent border-0 p-0 font-[inherit] text-sky-900';
    override.textContent = t('banner.override');
    override.addEventListener('click', openPanel);

    text.append(title, detail, override);
    banner.append(Object.assign(document.createElement('span'), {textContent: 'ℹ'}), text);
    document.querySelector('demo-header')?.after(banner);
}

function updateBadge(
    area: HTMLElement,
    key: EnvKey,
    input: HTMLInputElement | HTMLTextAreaElement,
) {
    area.innerHTML = '';
    const overridden = isOverridden(key);

    const badge = document.createElement('span');
    badge.className = overridden
        ? 'text-xs px-1.5 py-px bg-violet-100 text-violet-700 rounded-full font-medium'
        : 'text-xs px-1.5 py-px bg-bg border border-border text-muted rounded-full';
    badge.textContent = overridden ? t('panel.local') : t('panel.env');
    area.appendChild(badge);

    if (overridden) {
        const btn = document.createElement('button');
        btn.className =
            'text-xs text-muted hover:text-error cursor-pointer bg-transparent border-0 font-[inherit] p-0 leading-none';
        btn.title = t('panel.resetOne');
        btn.textContent = '↺';
        btn.addEventListener('click', () => {
            resetEnv(key);
            input.value = getBuildDefault(key);
            updateBadge(area, key, input);
        });
        area.appendChild(btn);
    }
}

function createRow(key: EnvKey): HTMLElement {
    const row = document.createElement('div');
    row.className = 'px-4 py-3';
    row.dataset.key = key;

    // Label row
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-1.5';
    const label = document.createElement('span');
    label.className = 'text-xs font-semibold text-text';
    label.textContent = t(LABELS[key]);
    const badgeArea = document.createElement('div');
    badgeArea.className = 'flex items-center gap-1.5';
    header.appendChild(label);
    header.appendChild(badgeArea);
    row.appendChild(header);

    // Input
    const isLong = key === 'VITE_PURSE_SESSION_JSON';
    let input: HTMLInputElement | HTMLTextAreaElement;
    const baseInputClass =
        'w-full text-xs font-mono border border-border rounded-md px-2 py-1.5 bg-bg focus:outline-none focus:border-accent block';

    if (isLong) {
        const ta = document.createElement('textarea');
        ta.rows = 3;
        ta.className = baseInputClass + ' resize-none';
        ta.placeholder = t(HINTS[key]);
        input = ta;
    } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = baseInputClass;
        inp.placeholder = t(HINTS[key]);
        input = inp;
    }
    input.value = getEnv(key);
    row.appendChild(input);

    // Default hint (truncated)
    const def = getBuildDefault(key);
    if (def) {
        const hint = document.createElement('div');
        hint.className = 'text-xs text-muted mt-1 truncate';
        hint.title = def;
        const code = document.createElement('span');
        code.className = 'font-mono';
        code.textContent = def.length > 32 ? def.slice(0, 32) + '…' : def;
        hint.append(`${t('panel.default')} `, code);
        row.appendChild(hint);
    }

    updateBadge(badgeArea, key, input);

    input.addEventListener('input', () => {
        setEnv(key, input.value);
        updateBadge(badgeArea, key, input);
    });

    return row;
}

/**
 * Mount the floating debug panel with the settings that apply to the calling
 * demo — a demo that never reads a key must not offer it, or the panel reads as
 * a list of things to fill in before anything works.
 *
 * `keys` is ordered as displayed; it defaults to every key for a page that
 * genuinely uses all of them.
 */
export function mountDebugPanel(keys: readonly EnvKey[] = ENV_KEYS) {
    if (document.getElementById('purse-debug-host')){
        console.debug('Debug panel already mounted')
        return;
    }
    if (keys.length === 0) return;

    // Root host — fixed bottom-right
    const host = document.createElement('div');
    host.id = 'purse-debug-host';
    host.style.cssText =
        'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;';
    document.body.appendChild(host);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'bg-white border border-border rounded-xl overflow-hidden';
    panel.style.cssText = 'display:none;width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.14);';

    // Panel header
    const panelHeader = document.createElement('div');
    panelHeader.className =
        'flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg';
    panelHeader.innerHTML = `<span class="font-semibold text-xs uppercase tracking-wider text-muted">${t('panel.title')}</span>`;

    const headerActions = document.createElement('div');
    headerActions.className = 'flex items-center gap-2';

    const resetAllBtn = document.createElement('button');
    resetAllBtn.className =
        'text-xs text-error hover:underline cursor-pointer bg-transparent border-0 font-[inherit] p-0';
    resetAllBtn.textContent = t('panel.resetAll');

    const reloadBtn = document.createElement('button');
    reloadBtn.className =
        'text-xs px-2.5 py-1 bg-accent text-white rounded-full cursor-pointer border-0 font-[inherit] hover:bg-accent-hover transition-colors';
    reloadBtn.textContent = t('panel.reload');

    const closeBtn = document.createElement('button');
    closeBtn.className =
        'text-muted hover:text-text cursor-pointer bg-transparent border-0 font-[inherit] text-base leading-none p-0';
    closeBtn.textContent = '×';

    headerActions.append(resetAllBtn, reloadBtn, closeBtn);
    panelHeader.appendChild(headerActions);
    panel.appendChild(panelHeader);

    // Field rows separated by dividers
    const fieldsEl = document.createElement('div');
    fieldsEl.className = 'divide-y divide-border max-h-96 overflow-y-auto';
    for (const key of keys) fieldsEl.appendChild(createRow(key));
    panel.appendChild(fieldsEl);

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className =
        'px-3 py-1.5 bg-white border border-border rounded-full text-xs font-semibold text-muted cursor-pointer hover:border-accent hover:text-accent transition-all';
    toggleBtn.style.cssText = 'box-shadow:0 2px 8px rgba(0,0,0,0.10);';
    toggleBtn.textContent = t('panel.toggle');

    host.appendChild(panel);
    host.appendChild(toggleBtn);

    mountDefaultsBanner(keys, () => {
        panel.style.display = 'block';
    });

    // Interactions
    toggleBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });
    reloadBtn.addEventListener('click', () => location.reload());
    resetAllBtn.addEventListener('click', () => {
        // Only the keys this panel shows — a demo must not clear overrides it
        // never displayed.
        resetForKeys(keys);
        // Refresh all rows
        fieldsEl.querySelectorAll('[data-key]').forEach(row => {
            const key = (row as HTMLElement).dataset.key as EnvKey;
            const input = row.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
            const badgeArea = row.querySelector('.flex.items-center.gap-1\\.5') as HTMLElement;
            input.value = getBuildDefault(key);
            updateBadge(badgeArea, key, input);
        });
    });
}

