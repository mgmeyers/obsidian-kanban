export function getParentWindow(el: Element) {
  return el.ownerDocument.defaultView;
}

export function getParentBodyElement(el: Element) {
  return el.ownerDocument.body;
}
