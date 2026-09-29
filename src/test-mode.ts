// Opt-in sandbox only; ordinary URLs use the production run and saved progress.
export const bossTestMode=new URLSearchParams(globalThis.location?.search??'').get('test')==='boss';
