import {createDemo} from '../utils';
import template from './template.html?raw';
import rawScript from './script.ts?raw';
import styles from './styles.css?raw';


export const secureFieldsDemo = (dynamicData?: Record<string, any>) => {
    const tenantId = dynamicData?.tenantId ?? process.env.VITE_PURSE_SECUREFIELDS_TENANT_ID ?? ''
    const apiKey = dynamicData?.apiKey ?? process.env.VITE_PURSE_API_KEY ?? '';
    return createDemo({
        template,
        script: rawScript
            .replace("'__TENANT_ID__'", `'${tenantId}'`)
            .replace("'__API_KEY__'", `'${apiKey}'`),
        styles,
        needsSession: false

    });
};
