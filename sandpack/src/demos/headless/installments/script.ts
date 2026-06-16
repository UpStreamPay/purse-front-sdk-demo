// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const methodListEl = document.getElementById('method-list');
  const simulateBtn  = document.getElementById('simulate-btn') as HTMLButtonElement;
  const resultEl     = document.getElementById('simulation-result');
  const amountInput  = document.getElementById('amount') as HTMLInputElement;

  let selectedMethod = null;

  checkout.paymentMethods.subscribe((methods) => {
    const simulable = methods.filter(m => !m.isSecondary && m.simulable);

    methodListEl.innerHTML = '';

    if (!simulable.length) {
      methodListEl.innerHTML =
        '<p class="text-sm text-gray-400 italic px-1">No simulable installment method in this session.</p>';
      return;
    }

    simulable.forEach((method) => {
      const btn = document.createElement('button');
      btn.className = 'method-btn flex items-center gap-3 w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 mb-2 text-sm font-medium text-gray-700 bg-white cursor-pointer';

      const icon = document.createElement('img');
      icon.src = method.iconUrl;
      icon.alt = method.method;
      icon.className = 'w-7 h-7 rounded object-contain shrink-0';

      const label = document.createElement('span');
      label.textContent = method.name ?? `${method.method} (${method.partner})`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        methodListEl.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMethod = method;
        simulateBtn.disabled = false;
      });
      methodListEl.appendChild(btn);
    });
  });

  simulateBtn.addEventListener('click', async () => {
    if (!selectedMethod) return;

    simulateBtn.disabled = true;
    simulateBtn.textContent = 'Simulating…';
    resultEl.innerHTML = '';

    const amount = parseFloat(amountInput.value) || 300;

    try {
      const plan = await selectedMethod.simulateLoan({ amount, currency_code: 'EUR' });
      renderPlan(plan, amount);
    } catch (err) {
      resultEl.innerHTML = `<p class="sim-error">${err.message}</p>`;
    } finally {
      simulateBtn.disabled = false;
      simulateBtn.textContent = 'Simulate';
    }
  });

  function renderPlan(plan, amount) {
    const fmt = (v) => `€${Number(v).toFixed(2)}`;
    const rows = [];

    for (let i = 1; i <= plan.installmentCount; i++) {
      const isFirst = i === 1;
      const isLast  = i === plan.installmentCount;
      const cellAmt = isFirst
        ? plan.initialInstallmentAmount
        : isLast
          ? plan.finalInstallmentAmount
          : plan.installmentAmount;
      rows.push(`
        <tr>
          <td class="sim-td">${i}</td>
          <td class="sim-td font-medium">${fmt(cellAmt)}</td>
        </tr>`);
    }

    resultEl.innerHTML = `
      <div class="sim-card">
        <div class="sim-header">
          <span>${plan.installmentCount} instalments</span>
          <span>${fmt(plan.installmentAmount)}/month</span>
        </div>
        <table class="sim-table">
          <thead>
            <tr>
              <th class="sim-th">#</th>
              <th class="sim-th">Amount</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
        <div class="sim-footer">
          <div class="sim-row"><span>Total cost</span><span>${fmt(plan.totalCost)}</span></div>
          <div class="sim-row"><span>Total amount</span><span class="font-semibold">${fmt(plan.totalAmount)}</span></div>
          ${plan.aprc != null ? `<div class="sim-row"><span>TAEG / APR</span><span>${(plan.aprc * 100).toFixed(2)}%</span></div>` : ''}
        </div>
        ${plan.legalText ? `<p class="sim-legal">${plan.legalText}</p>` : ''}
      </div>`;
  }
}

init();
