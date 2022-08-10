export function update(
  el: HTMLTextAreaElement,
  headToCursor: string,
  cursorToTail?: string
) {
  const doc = el.doc;
  const curr = el.value; // strA + strB1 + strC
  const next = headToCursor + (cursorToTail || ''); // strA + strB2 + strC
  const activeElement = doc.activeElement as HTMLElement;

  //  Calculate length of strA and strC
  let aLength = 0;
  let cLength = 0;
  while (
    aLength < curr.length &&
    aLength < next.length &&
    curr[aLength] === next[aLength]
  ) {
    aLength++;
  }
  while (
    curr.length - cLength - 1 >= 0 &&
    next.length - cLength - 1 >= 0 &&
    curr[curr.length - cLength - 1] === next[next.length - cLength - 1]
  ) {
    cLength++;
  }
  aLength = Math.min(aLength, Math.min(curr.length, next.length) - cLength);

  // Select strB1
  el.setSelectionRange(aLength, curr.length - cLength);

  // Get strB2
  const strB2 = next.substring(aLength, next.length - cLength);

  // Replace strB1 with strB2
  el.focus();
  if (!doc.execCommand('insertText', false, strB2)) {
    // Document.execCommand returns false if the command is not supported.
    // Firefox and IE returns false in this case.
    el.value = next;

    // Dispatch input event. Note that `new Event("input")` throws an error on IE11
    const event = doc.createEvent('Event');
    event.initEvent('input', true, true);
    el.dispatchEvent(event);
  }

  // Move cursor to the end of headToCursor
  el.setSelectionRange(headToCursor.length, headToCursor.length);

  activeElement.focus();
  return el;
}
