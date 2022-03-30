import { EventEmitter } from "eventemitter3"

import { Strategy, StrategyProps } from "./Strategy"
import { SearchResult } from "./SearchResult"

export class Completer extends EventEmitter {
  private readonly strategies: Strategy<unknown>[]

  constructor(strategyPropsList: StrategyProps<unknown>[]) {
    super()
    this.strategies = strategyPropsList.map((p) => new Strategy(p))
  }

  destroy(): this {
    this.strategies.forEach((s) => s.destroy())
    return this
  }

  run(beforeCursor: string): void {
    for (const strategy of this.strategies) {
      const executed = strategy.execute(beforeCursor, this.handleQueryResult)
      if (executed) return
    }
    this.handleQueryResult([])
  }

  private handleQueryResult = <T>(searchResults: SearchResult<T>[]) => {
    this.emit("hit", { searchResults })
  }
}
