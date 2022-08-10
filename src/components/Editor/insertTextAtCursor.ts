let browserSupportsTextareaTextNodes: undefined | boolean;

function canManipulateViaTextNodes(input: HTMLTextAreaElement) {
  if (input.nodeName !== 'TEXTAREA') {
    return false;
  }
  if (typeof browserSupportsTextareaTextNodes === 'undefined') {
    const textarea = input.doc.createElement('textarea');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    textarea.value = 1;
    browserSupportsTextareaTextNodes = !!textarea.firstChild;
  }
  return browserSupportsTextareaTextNodes;
}

export function insertTextAtCursor(input: HTMLTextAreaElement, text: string) {
  // Most of the used APIs only work with the field selected
  input.focus();

  const doc = input.doc;

  // Webkit + Edge
  const isSuccess = doc.execCommand('insertText', false, text);
  if (!isSuccess) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    // Firefox (non-standard method)
    if (typeof input.setRangeText === 'function') {
      input.setRangeText(text);
    } else {
      // To make a change we just need a Range, not a Selection
      const range = doc.createRange();
      const textNode = doc.createTextNode(text);

      if (canManipulateViaTextNodes(input)) {
        let node = input.firstChild;

        // If textarea is empty, just insert the text
        if (!node) {
          input.appendChild(textNode);
        } else {
          // Otherwise we need to find a nodes for start and end
          let offset = 0;
          let startNode: ChildNode | null = null;
          let endNode: ChildNode | null = null;

          while (node && (startNode === null || endNode === null)) {
            const nodeLength = node.nodeValue?.length || 0;

            // if start of the selection falls into current node
            if (start >= offset && start <= offset + nodeLength) {
              range.setStart((startNode = node), start - offset);
            }

            // if end of the selection falls into current node
            if (end >= offset && end <= offset + nodeLength) {
              range.setEnd((endNode = node), end - offset);
            }

            offset += nodeLength;
            node = node.nextSibling;
          }

          // If there is some text selected, remove it as we should replace it
          if (start !== end) {
            range.deleteContents();
          }
        }
      }

      // If the node is a textarea and the range doesn't span outside the element
      //
      // Get the commonAncestorContainer of the selected range and test its type
      // If the node is of type `#text` it means that we're still working with text nodes within our textarea element
      // otherwise, if it's of type `#document` for example it means our selection spans outside the textarea.
      if (
        canManipulateViaTextNodes(input) &&
        range.commonAncestorContainer.nodeName === '#text'
      ) {
        // Finally insert a new node. The browser will automatically split start and end nodes into two if necessary
        range.insertNode(textNode);
      } else {
        // If the node is not a textarea or the range spans outside a textarea the only way is to replace the whole value
        const value = input.value;
        input.value = value.slice(0, start) + text + value.slice(end);
      }
    }

    // Correct the cursor position to be at the end of the insertion
    input.setSelectionRange(start + text.length, start + text.length);

    // Notify any possible listeners of the change
    const e = doc.createEvent('UIEvent');
    e.initEvent('input', true, false);
    input.dispatchEvent(e);
  }
}
