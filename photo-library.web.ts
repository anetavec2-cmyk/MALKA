// Browser saving uses save-photo.web.ts. Never import the native module here.
export const Asset = { async create(_uri: string) { throw new Error('Use browser downloads'); } };
export async function requestPermissionsAsync(_writeOnly?: boolean, _permissions?: string[]) { return { granted: true }; }
