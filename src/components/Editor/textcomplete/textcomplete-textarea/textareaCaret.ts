// We'll copy the properties below into the mirror div.
// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
const properties = [
  'direction', // RTL support
  'boxSizing',
  'width', // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY', // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration', // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize',
];

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
) {
  const doc = element.doc;
  const win = element.win;

  // The mirror div will replicate the textarea's style
  const div = doc.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  doc.body.appendChild(div);

  const style = div.style;
  const computed = win.getComputedStyle(element);

  // Default textarea styles
  style.whiteSpace = 'pre-wrap';

  // Position off-screen
  style.position = 'absolute'; // required to return coordinates properly

  // Transfer the element's properties to the div
  properties.forEach((prop) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    style[prop] = computed[prop];
  });

  style.overflow = 'hidden'; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'

  div.textContent = element.value.substring(0, position);

  const span = doc.createElement('span');
  // Wrapping must be replicated *exactly*, including when a long word gets
  // onto the next line, with whitespace at the end of the line before (#7).
  // The  *only* reliable way to do that is to copy the *entire* rest of the
  // textarea's content into the <span> created at the caret position.
  // For inputs, just '.' would be enough, but no need to bother.
  span.textContent = element.value.substring(position) || '.'; // || because a completely empty faux span doesn't render at all
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
    height: parseInt(computed['lineHeight']),
  };

  doc.body.removeChild(div);

  return coordinates;
}
