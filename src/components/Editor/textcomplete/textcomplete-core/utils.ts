const isCustomEventSupported =
  typeof window !== "undefined" && !!window.CustomEvent

export const createCustomEvent = <T>(
  type: string,
  options?: CustomEventInit<T>
): CustomEvent<T> => {
  if (isCustomEventSupported) return new CustomEvent(type, options)
  const event = document.createEvent("CustomEvent")
  event.initCustomEvent(
    type,
    /* bubbles */ false,
    options?.cancelable || false,
    options?.detail || undefined
  )
  return event
}
