declare module '@vite-pwa/assets-generator/api' {
  export type AssetsResult = unknown;
}

declare module '@vite-pwa/assets-generator/config' {
  export type AssetsOptions = unknown;
}

declare global {
  type Args = unknown[];
  interface ExtendableEvent extends Event {}
}

export {};
