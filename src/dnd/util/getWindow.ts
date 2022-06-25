export function getWindowFromEl(el: HTMLElement) {
  return el.ownerDocument.defaultView;
}

export function getBodyFromEl(el: HTMLElement) {
  return el.ownerDocument.body;
}
