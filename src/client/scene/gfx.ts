/** Which look the world is built with (chosen once at start-up, before any material is made). */
export const GFX = { realistic: false };
export function setRealistic(on: boolean): void { GFX.realistic = on; }
