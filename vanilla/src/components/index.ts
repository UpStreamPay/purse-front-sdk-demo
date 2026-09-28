// Registers every demo custom element as a side effect. Import once per page:
//   import '../components';
// …and translates the page's static markup (data-i18n* attributes).
import { applyI18n } from '../i18n';
import './demo-locale-picker';
import './demo-header';
import './demo-stepper';
import './demo-notice';
import './demo-button';
import './demo-result';
import './sf-card-form';
import './demo-brand-pills';
import './demo-option-list';
import './demo-chips';
import './demo-redirection';

// Module scripts run after the document is parsed, so the markup is all there.
applyI18n();

export type { StepState } from './demo-stepper';
export type { Option } from './demo-option-list';
export type { Chip } from './demo-chips';
export type { RedirectionPlanView } from './demo-redirection';
