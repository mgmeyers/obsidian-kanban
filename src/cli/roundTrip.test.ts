import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { boardToMd, mdToBoard, serializeBoard } from './board';

const fixtureDir = join(__dirname, '__fixtures__');
const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith('.md'));

describe('round trip', () => {
  it('has fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('%s survives parse and serialize unchanged', (fixture) => {
    const md = readFileSync(join(fixtureDir, fixture), 'utf8');
    expect(boardToMd(mdToBoard(md, fixture))).toBe(md);
  });

  // Obsidian vaults are edited on every platform, and editors disagree about a
  // final newline. Neither may turn into a whole-file rewrite.
  it.each(fixtures)('%s survives with CRLF line endings', (fixture) => {
    const md = readFileSync(join(fixtureDir, fixture), 'utf8').replace(/\n/g, '\r\n');
    expect(serializeBoard(mdToBoard(md, fixture), md)).toBe(md);
  });

  it.each(fixtures)('%s survives with a final newline', (fixture) => {
    const md = readFileSync(join(fixtureDir, fixture), 'utf8') + '\n';
    expect(serializeBoard(mdToBoard(md, fixture), md)).toBe(md);
  });

  it.each(fixtures)('%s survives with CRLF and a final newline', (fixture) => {
    const md = (readFileSync(join(fixtureDir, fixture), 'utf8') + '\n').replace(/\n/g, '\r\n');
    expect(serializeBoard(mdToBoard(md, fixture), md)).toBe(md);
  });
});

describe('serializeBoard', () => {
  const md = readFileSync(join(fixtureDir, 'simple.md'), 'utf8');

  it('leaves an LF board without a final newline alone', () => {
    expect(serializeBoard(mdToBoard(md, 'x.md'), md)).toBe(boardToMd(mdToBoard(md, 'x.md')));
  });

  it('does not add a final newline to a board that lacks one', () => {
    expect(serializeBoard(mdToBoard(md, 'x.md'), md).endsWith('%%')).toBe(true);
  });

  it('carries an edit through without changing the line endings', () => {
    const crlf = md.replace(/\n/g, '\r\n');
    const board = mdToBoard(crlf, 'x.md');
    board.children[0].children.pop();
    const out = serializeBoard(board, crlf);
    expect(out).not.toContain('Second card');
    expect(/(?<!\r)\n/.test(out)).toBe(false);
  });
});
