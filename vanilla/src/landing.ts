// Landing page: registers the components (locale picker) and translates the
// page's data-i18n markup — the same side effect every demo page gets.
import './components';
import { BADGE_CLASSES, SECTIONS, demoHref, demosOf, pick } from '../../shared/demos';

// Cards come from the shared catalogue (demos.json), this app's demos only.
const demos = demosOf('vanilla');
document.getElementById('demo-list')!.innerHTML = SECTIONS.map(section => {
  const cards = demos.filter(d => d.section === section.id);
  if (!cards.length) {
    return '';
  }
  return `
    <h2 class="text-base font-bold mb-3 mt-2">${pick(section.title)}</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-0 mb-7">
      ${cards.map(demo => `
        <a href="${demoHref(demo, 'vanilla')}" class="block p-4 bg-white border border-border rounded-xl no-underline text-inherit transition-all hover:border-accent hover:ring-2 hover:ring-accent/10">
          <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${BADGE_CLASSES[section.variant]}">${section.badge}</span>
          <div class="font-semibold text-base my-2">${pick(demo.title)}</div>
          <div class="text-sm text-muted">${pick(demo.desc)}</div>
        </a>`).join('')}
    </div>`;
}).join('');
