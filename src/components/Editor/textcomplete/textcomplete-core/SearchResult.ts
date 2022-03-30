import { Strategy } from "./Strategy"

const MAIN = /\$&/g
const PLACE = /\$(\d)/g

export class SearchResult<T = unknown> {
  constructor(
    public readonly data: T,
    private readonly term: string,
    private readonly strategy: Strategy<T>
  ) {}

  getReplacementData(beforeCursor: string): {
    start: number
    end: number
    beforeCursor: string
    afterCursor: string
  } | null {
    let result = this.strategy.replace(this.data)
    if (result == null) return null

    let afterCursor = ""
    if (Array.isArray(result)) {
      afterCursor = result[1]
      result = result[0]
    }
    const match = this.strategy.match(beforeCursor)
    if (match == null || match.index == null) return null
    const replacement = result
      .replace(MAIN, match[0])
      .replace(PLACE, (_, p) => match[parseInt(p)])

    return {
      start: match.index,
      end: match.index + match[0].length,
      beforeCursor: replacement,
      afterCursor: afterCursor,
    }
  }

  replace(beforeCursor: string, afterCursor: string): [string, string] | void {
    const replacement = this.getReplacementData(beforeCursor)

    if (replacement === null) return

    afterCursor = replacement.afterCursor + afterCursor

    return [
      [
        beforeCursor.slice(0, replacement.start),
        replacement.beforeCursor,
        beforeCursor.slice(replacement.end),
      ].join(""),
      afterCursor,
    ]
  }

  render(): string {
    return this.strategy.renderTemplate(this.data, this.term)
  }

  getStrategyId(): string | null {
    return this.strategy.getId()
  }
}
