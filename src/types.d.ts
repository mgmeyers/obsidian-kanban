import 'obsidian';

import { DataviewApi } from 'obsidian-dataview';

declare module 'obsidian' {
  interface App {
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        [id: string]: any;
        dataview?: {
          api?: DataviewApi;
        };
      };
    };
  }

  interface MetadataCache {
    on(
      name: 'dataview:api-ready',
      callback: (api: DataviewApi) => any,
      ctx?: any
    ): EventRef;
    on(
      name: 'dataview:metadata-change',
      callback: (op: string, file: TFile) => any,
      ctx?: any
    ): EventRef;
  }
}
