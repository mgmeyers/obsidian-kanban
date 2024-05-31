import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import { lessLoader } from 'esbuild-plugin-less';
import fs from 'fs';
import MagicString from 'magic-string';
import path from 'path';
import process from 'process';

const toFunction = (functionOrValue) => {
  if (typeof functionOrValue === 'function') return functionOrValue;
  return () => functionOrValue;
};

const escape = (str) => str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

const longest = (a, b) => b.length - a.length;

const mapToFunctions = (options) => {
  const values = options.values ? Object.assign({}, options.values) : Object.assign({}, options);
  delete values.delimiters;
  delete values.include;
  delete values.exclude;

  return Object.keys(values).reduce((fns, key) => {
    const functions = Object.assign({}, fns);
    functions[key] = toFunction(values[key]);
    return functions;
  }, {});
};

const generateFilter = (options) => {
  let include = /.*/;
  let exclude = null;
  let hasValidInclude = false;

  if (options.include) {
    if (Object.prototype.toString.call(options.include) !== '[object RegExp]') {
      console.warn(
        `Options.include must be a RegExp object, but gets an '${typeof options.include}' type.`
      );
    } else {
      hasValidInclude = true;
      include = options.include;
    }
  }

  if (options.exclude) {
    if (Object.prototype.toString.call(options.exclude) !== '[object RegExp]') {
      console.warn(
        `Options.exclude must be a RegExp object, but gets an '${typeof options.exclude}' type.`
      );
    } else if (!hasValidInclude) {
      // Only if `options.include` not set, take `options.exclude`
      exclude = options.exclude;
    }
  }

  return { include, exclude };
};

const replaceCode = (code, id, pattern, functionValues) => {
  const magicString = new MagicString(code);
  let match = null;

  while ((match = pattern.exec(code))) {
    const start = match.index;
    if (code[start - 1] === '.') continue;
    const end = start + match[0].length;
    const replacement = String(functionValues[match[1]](id));
    magicString.overwrite(start, end, replacement);
  }
  return magicString.toString();
};

// todo: add preventAssignment option & support sourceMap
const replace = (options = {}) => {
  const { include, exclude } = generateFilter(options);
  const functionValues = mapToFunctions(options);
  const empty = Object.keys(functionValues).length === 0;
  const keys = Object.keys(functionValues).sort(longest).map(escape);
  const { delimiters } = options;
  const pattern = delimiters
    ? new RegExp(`${escape(delimiters[0])}(${keys.join('|')})${escape(delimiters[1])}`, 'g')
    : new RegExp(`\\b(${keys.join('|')})\\b`, 'g');
  return {
    name: 'replace',
    setup(build) {
      build.onLoad({ filter: include }, async (args) => {
        // if match exclude, skip
        if (exclude && args.path.match(exclude)) {
          return;
        }
        const source = await fs.promises.readFile(args.path, 'utf8');
        const contents = empty ? source : replaceCode(source, args.path, pattern, functionValues);
        return { contents, loader: 'default' };
      });
    },
  };
};

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
          const resolved = args.path === 'buffer' ? path.resolve('./buffer-es6.mjs') : null;
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
  plugins: [
    NodeModulesPolyfillPlugin(),
    lessLoader(),
    replace({
      include: /node_modules\/.*/,
      values: {
        setTimeout: 'activeWindow.setTimeout',
        clearTimeout: 'activeWindow.clearTimeout',
        requestAnimationFrame: 'activeWindow.requestAnimationFrame',
        cancelAnimationFrame: 'activeWindow.cancelAnimationFrame',
      },
    }),
  ],
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
