import {createDemo} from '../utils';
import template from './template.html?raw';
import script from './script.ts?raw';
import styles from './styles.css?raw';

export const dropinDemo = (dynamicData?: Record<string, any>) =>
    createDemo({ template, script, styles, redirectionUrl: dynamicData?.redirectionUrl });
