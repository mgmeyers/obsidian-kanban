import {
  Extension as FromMarkdownExtension,
  Token,
} from 'mdast-util-from-markdown';
import { markdownLineEnding, markdownSpace } from 'micromark-util-character';
import { Effects, Extension, State } from 'micromark-util-types';

import { getSelf } from './helpers';

export function blockidExtension(): Extension {
  const name = 'blockid';
  const startMarker = '^';

  function tokenize(effects: Effects, ok: State, nok: State) {
    let data = false;
    let startMarkerCursor = 0;

    return start;

    function start(code: number) {
      if (code !== startMarker.charCodeAt(startMarkerCursor)) return nok(code);

      effects.enter(name);
      effects.enter(`${name}Marker`);

      return consumeStart(code);
    }

    function consumeStart(code: number) {
      if (startMarkerCursor === startMarker.length) {
        effects.exit(`${name}Marker`);
        return consumeData(code);
      }

      if (code !== startMarker.charCodeAt(startMarkerCursor)) {
        return nok(code);
      }

      effects.consume(code);
      startMarkerCursor++;

      return consumeStart;
    }

    function consumeData(code: number) {
      effects.enter(`${name}Data`);
      effects.enter(`${name}Target`);
      return consumeTarget(code);
    }

    function consumeTarget(code: number) {
      if (markdownSpace(code)) {
        return nok(code);
      }

      if (markdownLineEnding(code) || code === null) {
        if (!data) return nok(code);
        effects.exit(`${name}Target`);
        effects.exit(`${name}Data`);
        effects.exit(name);

        return ok(code);
      }

      data = true;
      effects.consume(code);

      return consumeTarget;
    }
  }

  const call = { tokenize: tokenize };

  return {
    text: { [startMarker.charCodeAt(0)]: call },
  };
}

export function blockidFromMarkdown(): FromMarkdownExtension {
  const name = 'blockid';

  function enter(token: Token) {
    this.enter(
      {
        type: name,
        value: null,
      },
      token
    );
  }

  function exitTarget(token: Token) {
    const target = this.sliceSerialize(token);
    const current = getSelf(this.stack);

    (current as any).value = target;
  }

  function exit(token: Token) {
    this.exit(token);
  }

  return {
    enter: {
      [name]: enter,
    },
    exit: {
      [`${name}Target`]: exitTarget,
      [name]: exit,
    },
  };
}
