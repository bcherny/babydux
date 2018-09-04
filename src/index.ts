import { Observable } from 'rxjs-observable'
import { Emitter } from './Emitter'
import { mapValues } from './utils'

const CYCLE_ERROR_MESSAGE =
  '[undux] Error: Cyclical dependency detected. ' +
  'This may cause a stack overflow unless you fix it. \n' +
  'The culprit is the following sequence of .set calls, ' +
  'called from one or more of your Undux Effects: '

export type Undux<State extends object> = {
  [K in keyof State]: {
    key: K
    previousValue: State[K]
    value: State[K]
  }
}

/**
 * Public Store interface. When you want to reference the Store type,
 * this is the type to use.
 */
export interface Store<State extends object> {
  get<K extends keyof State>(key: K): State[K]
  set<K extends keyof State>(key: K): (value: State[K]) => void
  on<K extends keyof State>(key: K): Observable<State[K]>
  onAll(): Observable<Undux<State>[keyof State]>
  getState(): Readonly<State>
}

/**
 * Immutable snapshot of the current store state. One StoreSnapshot per
 * StoreDefinition is usually alive at a time.
 */
export class StoreSnapshot<State extends object> implements Store<State> {
  constructor(
    private state: State,
    private storeDefinition: StoreDefinition<State>
  ) {}
  get<K extends keyof State>(key: K) {
    return this.state[key]
  }
  set<K extends keyof State>(key: K) {
    return this.storeDefinition.set(key)
  }
  on<K extends keyof State>(key: K) {
    return this.storeDefinition.on(key)
  }
  onAll() {
    return this.storeDefinition.onAll()
  }
  getState() {
    return Object.freeze(this.state)
  }
}

/**
 * Immutable edge from StoreSnapshot to a component that consumes it
 * via withStore(). We use it to keep track of which fields a consumer
 * reads from, so that we can improve performance by only subscribing
 * to those fields.
 */
export class StoreSnapshotWrapper<State extends object>
  implements Store<State> {
  constructor(
    private snapshot: StoreSnapshot<State>,
    private onGetOrSet: (key: keyof State) => void,
    private onGetAll: () => void
  ) {}
  get<K extends keyof State>(key: K) {
    this.onGetOrSet(key)
    return this.snapshot.get(key)
  }
  set<K extends keyof State>(key: K) {
    this.onGetOrSet(key)
    return this.snapshot.set(key)
  }
  on<K extends keyof State>(key: K) {
    return this.snapshot.on(key)
  }
  onAll() {
    return this.snapshot.onAll()
  }
  getState() {
    this.onGetAll()
    return this.snapshot.getState()
  }
}

export type Options = {
  isDevMode: boolean
}

let DEFAULT_OPTIONS: Readonly<Options> = {
  isDevMode: false
}

/**
 * We create a single instance of this per <Container />.
 */
export class StoreDefinition<State extends object> implements Store<State> {
  private storeSnapshot: StoreSnapshot<State>
  private alls: Emitter<Undux<State>>
  private emitter: Emitter<State>
  private setters: { readonly [K in keyof State]: (value: State[K]) => void }
  constructor(state: State, options: Options) {
    let emitterOptions = {
      isDevMode: options.isDevMode,
      onCycle(chain: (string | number | symbol)[]) {
        console.error(CYCLE_ERROR_MESSAGE + chain.join(' -> '))
      }
    }

    // Initialize emitters
    this.alls = new Emitter(emitterOptions)
    this.emitter = new Emitter(emitterOptions)

    // Set initial state
    this.storeSnapshot = new StoreSnapshot(state, this)

    // Cache setters
    this.setters = mapValues(state, (v, key) => (value: typeof v) => {
      let previousValue = this.storeSnapshot.get(key)
      this.storeSnapshot = new StoreSnapshot(
        Object.assign({}, this.storeSnapshot.getState(), { [key]: value }),
        this
      )
      this.emitter.emit(key, value)
      this.alls.emit(key, { key, previousValue, value })
    })
  }
  on<K extends keyof State>(key: K): Observable<State[K]> {
    return this.emitter.on(key)
  }
  onAll(): Observable<Undux<State>[keyof State]> {
    return this.alls.all()
  }
  get<K extends keyof State>(key: K) {
    return this.storeSnapshot.get(key)
  }
  set<K extends keyof State>(key: K): (value: State[K]) => void {
    return this.setters[key]
  }
  getCurrentSnapshot() {
    return this.storeSnapshot
  }
  toStore(): Store<State> {
    return this.storeSnapshot
  }
  getState() {
    return this.storeSnapshot.getState()
  }
}

/**
 * @deprecated Use `createConnectedStore` instead.
 */
export function createStore<State extends object>(
  initialState: State,
  options: Options = DEFAULT_OPTIONS
): StoreDefinition<State> {
  return new StoreDefinition<State>(initialState, options)
}

export type Effects<State extends object> = (
  store: StoreDefinition<State>
) => StoreDefinition<State>

export type EffectsAs<
  States extends {
    [alias: string]: any
  }
> = (
  stores: { [K in keyof States]: StoreDefinition<States[K]> }
) => { [K in keyof States]: StoreDefinition<States[K]> }

/**
 * @deprecated Use `Effects` instead.
 */
export type Plugin<State extends object> = (
  store: StoreDefinition<State>
) => StoreDefinition<State>

export * from './plugins/withLogger'
export * from './plugins/withReduxDevtools'
export * from './react'
