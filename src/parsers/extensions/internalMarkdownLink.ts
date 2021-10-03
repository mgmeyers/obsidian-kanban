import { Token } from 'mdast-util-from-markdown';

export function internalMarkdownLinks(
  process: (node: Record<string, any>, isEmbed: boolean) => void
) {
  function exitLink(token: Token) {
    process(this.stack[this.stack.length - 1], false);
    this.exit(token);
  }

  function exitImage(token: Token) {
    process(this.stack[this.stack.length - 1], true);
    this.exit(token);
  }

  return {
    exit: {
      link: exitLink,
      image: exitImage,
    },
  };
}
