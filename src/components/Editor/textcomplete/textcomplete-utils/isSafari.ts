export const isSafari = (): boolean =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
