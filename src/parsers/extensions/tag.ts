import {
  Extension as FromMarkdownExtension,
  Token,
} from 'mdast-util-from-markdown';
import { markdownLineEndingOrSpace } from 'micromark-util-character';
import { Effects, Extension, State } from 'micromark-util-types';

import { getSelf } from './helpers';

export function tagExtension(): Extension {
  const name = 'hashtag';
  const startMarker = '#';

  function tokenize(effects: Effects, ok: State, nok: State) {
    let data = false;
    let startMarkerCursor = 0;
    const self = this;

    return start;

    function start(code: number) {
      if (
        code !== startMarker.charCodeAt(startMarkerCursor) ||
        (startMarkerCursor === 0 &&
          // Tag must come after space or <br>
          self.previous !== ' '.charCodeAt(0) &&
          self.previous !== '>'.charCodeAt(0))
      ) {
        return nok(code);
      }

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
      if (
        markdownLineEndingOrSpace(code) ||
        // Take into account <br>
        '<'.charCodeAt(0) === code ||
        '#'.charCodeAt(0) === code ||
        code === null
      ) {
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

export function tagFromMarkdown(): FromMarkdownExtension {
  const name = 'hashtag';

  function enterTag(token: Token) {
    this.enter(
      {
        type: name,
        value: null,
      },
      token
    );
  }

  function exitTagTarget(token: Token) {
    const target = this.sliceSerialize(token);
    const current = getSelf(this.stack);

    (current as any).value = target;
  }

  function exitTag(token: Token) {
    this.exit(token);
  }

  return {
    enter: {
      [name]: enterTag,
    },
    exit: {
      [`${name}Target`]: exitTagTarget,
      [name]: exitTag,
    },
  };
}
