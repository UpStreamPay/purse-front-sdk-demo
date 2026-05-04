export const $ = (id: string) => document.getElementById(id)!;

export function setStep(id: string, state: 'active' | 'done' | 'error') {
  const el = $(id);
  el.dataset.state = state;
  const icon = el.querySelector('.step__icon')!;
  icon.textContent =
    state === 'done' ? '✓' : state === 'error' ? '✗' : icon.textContent;
}

export function showNotice(msg: string) {
  ($('setup-notice') as HTMLElement).style.display = 'flex';
  $('setup-notice-msg').textContent = msg;
}

export function showResult(type: 'success' | 'error', data: unknown, successLabel = 'Payment submitted') {
  const colorClasses =
    type === 'success'
      ? 'bg-success-bg border border-emerald-200 text-success'
      : 'bg-error-bg border border-red-300 text-error';
  $('result').innerHTML = `
    <div class="p-4 rounded-lg mt-4 text-sm ${colorClasses}">
      <div class="font-bold mb-1">${type === 'success' ? successLabel : 'Error'}</div>
      <pre class="font-mono text-xs break-all whitespace-pre-wrap mt-2 opacity-80">${JSON.stringify(data, null, 2)}</pre>
    </div>`;
}
