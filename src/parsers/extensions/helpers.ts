import { CompileContext } from 'mdast-util-from-markdown';

export function getSelf(stack: CompileContext['stack']) {
  return stack[stack.length - 1];
}
