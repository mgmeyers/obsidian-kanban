import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import { lessLoader } from 'esbuild-plugin-less';
import fs from 'fs';
import path from 'path';
import process from 'process';

const isProd = process.argv[2] === 'production';
const renamePlugin = {
  name: 'rename-styles',
  setup(build) {
    build.onEnd(() => {
      const { outfile } = build.initialOptions;
      const outcss = outfile.replace(/\.js$/, '.css');
      const fixcss = outfile.replace(/main\.js$/, 'styles.css');
      if (fs.existsSync(outcss)) {
        console.log('Renaming', outcss, 'to', fixcss);
        fs.renameSync(outcss, fixcss);
      }
    });
  },
};

const NAME = 'node-modules-polyfills';
const NAMESPACE = NAME;

function NodeModulesPolyfillPlugin(options = {}) {
  const { namespace = NAMESPACE, name = NAME } = options;
  if (namespace.endsWith('commonjs')) {
    throw new Error(`namespace ${namespace} must not end with commonjs`);
  }
  // this namespace is needed to make ES modules expose their default export to require: require('assert') will give you import('assert').default
  const commonjsNamespace = namespace + '-commonjs';

  return {
    name,
    setup: function setup({ onLoad, onResolve }) {
      // TODO these polyfill module cannot import anything, is that ok?
      async function loader(args) {
        try {
          const isCommonjs = args.namespace.endsWith('commonjs');
          const resolved =
            args.path === 'buffer' ? path.resolve('./buffer-es6.mjs') : null;
          const contents = (await fs.promises.readFile(resolved)).toString();

          let resolveDir = path.dirname(resolved);

          if (isCommonjs) {
            return {
              loader: 'js',
              contents: commonJsTemplate({
                importPath: args.path,
              }),
              resolveDir,
            };
          }

          return {
            loader: 'js',
            contents,
            resolveDir,
          };
        } catch (e) {
          console.error('node-modules-polyfill', e);
          return {
            contents: `export {}`,
            loader: 'js',
          };
        }
      }

      onLoad({ filter: /.*/, namespace }, loader);
      onLoad({ filter: /.*/, namespace: commonjsNamespace }, loader);

      const filter = /buffer/;

      async function resolver(args) {
        const ignoreRequire = args.namespace === commonjsNamespace;

        if (args.path !== 'buffer') {
          return;
        }

        const isCommonjs = !ignoreRequire && args.kind === 'require-call';

        return {
          namespace: isCommonjs ? commonjsNamespace : namespace,
          path: args.path,
        };
      }

      onResolve({ filter }, resolver);
    },
  };
}

function commonJsTemplate({ importPath }) {
  return `
const polyfill = require('${importPath}')
if (polyfill && polyfill.default) {
    module.exports = polyfill.default
    for (let k in polyfill) {
        module.exports[k] = polyfill[k]
    }
} else if (polyfill)  {
    module.exports = polyfill
}
`;
}

const context = await esbuild.context({
  entryPoints: ['./src/main.ts', './src/styles.less'],
  bundle: true,
  define: {
    global: 'window',
  },
  plugins: [NodeModulesPolyfillPlugin(), lessLoader()],
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/closebrackets',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/comment',
    '@codemirror/fold',
    '@codemirror/gutter',
    '@codemirror/highlight',
    '@codemirror/history',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/matchbrackets',
    '@codemirror/panel',
    '@codemirror/rangeset',
    '@codemirror/rectangular-selection',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/stream-parser',
    '@codemirror/text',
    '@codemirror/tooltip',
    '@codemirror/view',
    'node:*',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: isProd ? false : 'inline',
  treeShaking: true,
  outdir: './',
  minify: isProd,
});

if (isProd) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
