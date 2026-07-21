export type TacteloRuntimeEnv = {
  DB?: D1Database;
  TACTELO_ADMIN_KEY?: string;
};

declare global {
  // The worker sets this request-local binding object before routing to Vinext.
  var __TACTELO_RUNTIME_ENV__: TacteloRuntimeEnv | undefined;
}

export function getRuntimeEnv(): TacteloRuntimeEnv {
  return globalThis.__TACTELO_RUNTIME_ENV__ ?? {};
}
