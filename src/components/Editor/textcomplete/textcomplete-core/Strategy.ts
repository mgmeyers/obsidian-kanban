import { SearchResult } from "./SearchResult"

export type SearchCallback<T> = (results: T[]) => void
type ReplaceResult = [string, string] | string | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StrategyProps<T = any> {
  match: RegExp | ((regexp: string | RegExp) => RegExpMatchArray | null)
  search: (
    term: string,
    callback: SearchCallback<T>,
    match: RegExpMatchArray
  ) => void
  replace: (data: T) => ReplaceResult
  cache?: boolean
  context?: (text: string) => string | boolean
  template?: (data: T, term: string) => string
  index?: number
  id?: string
}

export const DEFAULT_INDEX = 1

export class Strategy<T> {
  private cache: Record<string, T[]> = {}

  constructor(private readonly props: StrategyProps<T>) {}

  destroy(): this {
    this.cache = {}
    return this
  }

  replace(data: T): ReplaceResult {
    return this.props.replace(data)
  }

  execute(
    beforeCursor: string,
    callback: (searchResults: SearchResult<T>[]) => void
  ): boolean {
    const match = this.matchWithContext(beforeCursor)
    if (!match) return false
    const term = match[this.props.index ?? DEFAULT_INDEX]
    this.search(
      term,
      (results: T[]) => {
        callback(results.map((result) => new SearchResult(result, term, this)))
      },
      match
    )
    return true
  }

  renderTemplate(data: T, term: string): string {
    if (this.props.template) {
      return this.props.template(data, term)
    }
    if (typeof data === "string") return data
    throw new Error(
      `Unexpected render data type: ${typeof data}. Please implement template parameter by yourself`
    )
  }

  getId(): string | null {
    return this.props.id || null
  }

  match(text: string): RegExpMatchArray | null {
    return typeof this.props.match === "function"
      ? this.props.match(text)
      : text.match(this.props.match)
  }

  private search(
    term: string,
    callback: SearchCallback<T>,
    match: RegExpMatchArray
  ): void {
    if (this.props.cache) {
      this.searchWithCach(term, callback, match)
    } else {
      this.props.search(term, callback, match)
    }
  }

  private matchWithContext(beforeCursor: string): RegExpMatchArray | null {
    const context = this.context(beforeCursor)
    if (context === false) return null
    return this.match(context === true ? beforeCursor : context)
  }

  private context(beforeCursor: string): string | boolean {
    return this.props.context ? this.props.context(beforeCursor) : true
  }

  private searchWithCach(
    term: string,
    callback: SearchCallback<T>,
    match: RegExpMatchArray
  ): void {
    if (this.cache[term] != null) {
      callback(this.cache[term])
    } else {
      this.props.search(
        term,
        (results) => {
          this.cache[term] = results
          callback(results)
        },
        match
      )
    }
  }
}
