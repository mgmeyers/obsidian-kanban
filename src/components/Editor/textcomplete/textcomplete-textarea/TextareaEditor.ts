import { update } from "undate"
import getCaretCoordinates from "textarea-caret"
import {
  Editor,
  CursorOffset,
  SearchResult,
  createCustomEvent,
} from "@textcomplete/core"
import { calculateElementOffset, getLineHeightPx } from "@textcomplete/utils"

export class TextareaEditor extends Editor {
  constructor(private readonly el: HTMLTextAreaElement) {
    super()
    this.startListening()
  }

  destroy(): this {
    super.destroy()
    this.stopListening()
    return this
  }

  /**
   * @implements {@link Editor#applySearchResult}
   */
  applySearchResult(searchResult: SearchResult): void {
    const beforeCursor = this.getBeforeCursor()
    if (beforeCursor != null) {
      const replace = searchResult.replace(beforeCursor, this.getAfterCursor())
      this.el.focus() // Clicking a dropdown item removes focus from the element.
      if (Array.isArray(replace)) {
        update(this.el, replace[0], replace[1])
        if (this.el) {
          this.el.dispatchEvent(createCustomEvent("input"))
        }
      }
    }
  }

  /**
   * @implements {@link Editor#getCursorOffset}
   */
  getCursorOffset(): CursorOffset {
    const elOffset = calculateElementOffset(this.el)
    const elScroll = this.getElScroll()
    const cursorPosition = this.getCursorPosition()
    const lineHeight = getLineHeightPx(this.el)
    const top = elOffset.top - elScroll.top + cursorPosition.top + lineHeight
    const left = elOffset.left - elScroll.left + cursorPosition.left
    const clientTop = this.el.getBoundingClientRect().top
    if (this.el.dir !== "rtl") {
      return { top, left, lineHeight, clientTop }
    } else {
      const right = document.documentElement
        ? document.documentElement.clientWidth - left
        : 0
      return { top, right, lineHeight, clientTop }
    }
  }

  /**
   * @implements {@link Editor#getBeforeCursor}
   */
  getBeforeCursor(): string | null {
    return this.el.selectionStart !== this.el.selectionEnd
      ? null
      : this.el.value.substring(0, this.el.selectionEnd)
  }

  private getAfterCursor(): string {
    return this.el.value.substring(this.el.selectionEnd)
  }

  private getElScroll(): { top: number; left: number } {
    return { top: this.el.scrollTop, left: this.el.scrollLeft }
  }

  /**
   * The input cursor's relative coordinates from the textarea's left
   * top corner.
   */
  private getCursorPosition(): { top: number; left: number } {
    return getCaretCoordinates(this.el, this.el.selectionEnd)
  }

  private onInput = () => {
    this.emitChangeEvent()
  }

  private onKeydown = (e: KeyboardEvent) => {
    const code = this.getCode(e)
    let event
    if (code === "UP" || code === "DOWN") {
      event = this.emitMoveEvent(code)
    } else if (code === "ENTER") {
      event = this.emitEnterEvent()
    } else if (code === "ESC") {
      event = this.emitEscEvent()
    }
    if (event && event.defaultPrevented) {
      e.preventDefault()
    }
  }

  private startListening(): void {
    this.el.addEventListener("input", this.onInput)
    this.el.addEventListener("keydown", this.onKeydown)
  }

  private stopListening(): void {
    this.el.removeEventListener("input", this.onInput)
    this.el.removeEventListener("keydown", this.onKeydown)
  }
}
