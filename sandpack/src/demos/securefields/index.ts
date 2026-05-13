import { createDemo } from '../utils';
import template from './template.html?raw';
import rawScript from './script.ts?raw';
import styles from './styles.css?raw';

const TENANT_ID = process.env.VITE_PURSE_SECUREFIELDS_TENANT_ID ?? '';
const API_KEY   = process.env.VITE_PURSE_API_KEY ?? '';

export const secureFieldsDemo = createDemo({
  template,
  script: rawScript
    .replace("'__TENANT_ID__'", `'${TENANT_ID}'`)
    .replace("'__API_KEY__'", `'${API_KEY}'`),
  styles,
});
