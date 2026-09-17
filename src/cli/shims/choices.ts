// Stub signatures mirror the real API, so parameters are named but unused.
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Stub for `choices.js`. The real library builds DOM nodes at load time.
 * `src/settingHelpers.ts` imports it for the settings UI, and the parser
 * reaches that module through `src/Settings.ts`.
 */
export class Choices {
  constructor(..._args: any[]) {}
  destroy() {}
  passedElement: any = {};
}

export default Choices;
