import { Emitter } from 'typed-rx-emitter'
import { equals } from './utils'

export type Undux<Actions extends object> = {
  [K in keyof Actions]: {
    key: K
    previousValue: Actions[K]
    value: Actions[K]
  }
}

export class Store<Actions extends object> extends Emitter<Actions> {
  private befores = new Emitter<Undux<Actions>>()
  private emitter = new Emitter<Actions>()
  constructor(private state: Actions) {
    super()

    for (let key in state) {
      this.emitter.on(key).subscribe(value => {
        let previousValue = state[key]

        if (!equals(previousValue, value)) {
          this.befores.emit(key, { key, previousValue, value })
          state[key] = value
          this.emit(key, value)
        }
      })
    }
  }
  before<K extends keyof Actions>(key: K) {
    return this.befores.on(key)
  }
  beforeAll<K extends keyof Actions>() {
    return this.befores.all()
  }
  get<K extends keyof Actions>(key: K) {
    return this.state[key]
  }
  set<K extends keyof Actions>(key: K) {
    return (value: Actions[K]) => this.emitter.emit(key, value)
  }
}

export function createStore<Actions extends object>(initialState: Actions) {
  return new Store<Actions>(initialState)
}

export type Plugin = <Actions extends object>(
  store: Store<Actions>
) => Store<Actions>

export * from './plugins/logger'
export * from './react'
