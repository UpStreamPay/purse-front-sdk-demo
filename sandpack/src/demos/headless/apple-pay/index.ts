import { createDemo } from '../../utils';
import template from './template.html?raw';
import script from './script.ts?raw';
import styles from './styles.css?raw';

export const applePayDemo = () => createDemo({ template, script, styles });
