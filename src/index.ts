import * as RxJS from 'rxjs'
import { Emitter } from 'typed-rx-emitter'
import { withReduxDevtools } from './plugins/reduxDevtools'
import { mapValues, Omit } from './utils'

export type Undux<Actions extends object> = {
  [K in keyof Actions]: {
    key: K
    previousValue: Actions[K]
    value: Actions[K]
  }
}

export interface Store<Actions extends object> {
  get<K extends keyof Actions>(key: K): Actions[K]
  set<K extends keyof Actions>(key: K): (value: Actions[K]) => void
  on<K extends keyof Actions>(key: K): RxJS.Observable<Actions[K]>
  onAll<K extends keyof Actions>(): RxJS.Observable<Undux<Actions>[keyof Actions]>
  getState(): Readonly<Actions>
}

export class StoreSnapshot<Actions extends object> implements Store<Actions> {
  constructor(
    private state: Actions,
    private store: StoreDefinition<Actions>
  ) { }
  get<K extends keyof Actions>(key: K) {
    return this.state[key]
  }
  set<K extends keyof Actions>(key: K) {
    return this.store.set(key)
  }
  on<K extends keyof Actions>(key: K) {
    return this.store.on(key)
  }
  onAll<K extends keyof Actions>() {
    return this.store.onAll()
  }
  getState() {
    return Object.freeze(this.state)
  }
}

export class StoreDefinition<Actions extends object> implements Store<Actions> {
  private store: StoreSnapshot<Actions>
  private alls: Emitter<Undux<Actions>> = new Emitter
  private emitter: Emitter<Actions> = new Emitter
  private setters: {
    readonly [K in keyof Actions]: (value: Actions[K]) => void
  }
  constructor(state: Actions) {

    // Set initial state
    this.store = new StoreSnapshot(state, this)

    // Cache setters
    this.setters = mapValues(state, (v, key) =>
      (value: typeof v) => {
        let previousValue = this.store.get(key)
        this.store = new StoreSnapshot(
          Object.assign({}, this.store.getState(), { [key]: value }),
          this
        )
        this.emitter.emit(key, value)
        this.alls.emit(key, { key, previousValue, value })
      }
    )
  }
  on<K extends keyof Actions>(key: K): RxJS.Observable<Actions[K]> {
    return this.emitter.on(key)
  }
  onAll<K extends keyof Actions>(): RxJS.Observable<Undux<Actions>[keyof Actions]> {
    return this.alls.all()
  }
  get<K extends keyof Actions>(key: K) {
    return this.store.get(key)
  }
  set<K extends keyof Actions>(key: K) {
    return this.setters[key]
  }
  getState() {
    return this.store.getState()
  }
}

export function createStore<Actions extends object>(
  initialState: Actions
): StoreDefinition<Actions> {
  return new StoreDefinition<Actions>(initialState)
}

export function createSafeStore<Actions extends object>(
  initialState: Actions
): Omit<StoreDefinition<Actions>, 'set'> {
  return new StoreDefinition<Actions>(initialState)
}

export type Plugin<Actions extends object> =
  (store: StoreDefinition<Actions>) => StoreDefinition<Actions>

export type SafePlugin<Actions extends object> =
  (store: Omit<StoreDefinition<Actions>, 'set'>) =>
    Omit<StoreDefinition<Actions>, 'set'>

export * from './plugins/logger'
export * from './plugins/reduxDevtools'
export * from './react'
