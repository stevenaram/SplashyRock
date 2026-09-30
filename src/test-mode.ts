// Opt-in sandbox only; ordinary URLs use the production run and saved progress.
export const bossTestMode=new URLSearchParams(globalThis.location?.search??'').get('test')==='boss';

export const scoreTestMode=new URLSearchParams(globalThis.location?.search??'').get('test')==='score';
export const bushTestMode=new URLSearchParams(globalThis.location?.search??'').get('test')==='bush';
export const forgeTestMode=new URLSearchParams(globalThis.location?.search??'').get('test')==='forge';
export const sandboxMode=forgeTestMode||bossTestMode||scoreTestMode||bushTestMode;
