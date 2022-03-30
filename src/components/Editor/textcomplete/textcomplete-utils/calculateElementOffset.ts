/**
 * Get the current coordinates of the `el` relative to the document.
 */
export const calculateElementOffset = (
  el: HTMLElement
): { top: number; left: number } => {
  const rect = el.getBoundingClientRect()
  const owner = el.ownerDocument
  if (owner == null) {
    throw new Error("Given element does not belong to document")
  }
  const { defaultView, documentElement } = owner
  if (defaultView == null) {
    throw new Error("Given element does not belong to window")
  }
  const offset = {
    top: rect.top + defaultView.pageYOffset,
    left: rect.left + defaultView.pageXOffset,
  }
  if (documentElement) {
    offset.top -= documentElement.clientTop
    offset.left -= documentElement.clientLeft
  }
  return offset
}
