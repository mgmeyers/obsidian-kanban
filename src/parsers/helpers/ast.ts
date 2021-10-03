import { Content } from 'mdast';
import { Paragraph } from 'mdast-util-from-markdown/lib';

export interface ContentBoundary {
  start: number;
  end: number;
}

export function getParagraphContentBoundary(
  paragraph: Paragraph
): ContentBoundary {
  if (paragraph.children.length === 0) return null;
  const last = paragraph.children.length - 1;

  if ((paragraph.children[last] as any).type === 'blockid') {
    if (last === 0) {
      return {
        start: paragraph.children[0].position.start.offset,
        end: paragraph.children[0].position.start.offset,
      };
    }

    return {
      start: paragraph.children[0].position.start.offset,
      end: paragraph.children[last - 1].position.end.offset,
    };
  }

  return {
    start: paragraph.children[0].position.start.offset,
    end: paragraph.children[last].position.end.offset,
  };
}

export function getListItemContent(md: string, boundary: ContentBoundary) {
  return md.slice(boundary.start, boundary.end);
}

export function getPrevSibling(children: Content[], currentIndex: number) {
  if (currentIndex <= 0) return null;
  return children[currentIndex - 1];
}
