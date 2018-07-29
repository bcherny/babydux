import { Emitter, Observable } from './emitter'
import { mapValues } from './utils'

const CYCLE_ERROR_MESSAGE = '[undux] Error: Cyclical dependency detected. '
  + 'This may cause a stack overflow unless you fix it. \n'
  + 'The culprit is the following sequence of .set calls, '
  + 'called from one or more of your Undux Effects: '

export type Undux<State extends object> = {
  [K in keyof State]: {
    key: K
    previousValue: State[K]
    value: State[K]
  }
}

export interface Store<State extends object> {
  get<K extends keyof State>(key: K): State[K]
  set<K extends keyof State>(key: K): (value: State[K]) => void
  getState(): Readonly<State>
}

export class StoreSnapshot<State extends object> implements Store<State> {
  constructor(
    private state: State,
    private storeDefinition: StoreDefinition<State>
  ) { }
  get<K extends keyof State>(key: K) {
    return this.state[key]
  }
  set<K extends keyof State>(key: K) {
    return this.storeDefinition.set(key)
  }
  getState() {
    return Object.freeze(this.state)
  }
}

export type Options = {
  isDevMode: boolean
}

let DEFAULT_OPTIONS: Readonly<Options> = {
  isDevMode: false
}

export class StoreDefinition<State extends object> implements Store<State> {
  private storeSnapshot: StoreSnapshot<State>
  private alls: Emitter<Undux<State>>
  private emitter: Emitter<State>
  private setters: {
    readonly [K in keyof State]: (value: State[K]) => void
  }
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
    this.setters = mapValues(state, (v, key) =>
      (value: typeof v) => {
        let previousValue = this.storeSnapshot.get(key)
        this.storeSnapshot = new StoreSnapshot(
          Object.assign({}, this.storeSnapshot.getState(), { [key]: value }),
          this
        )
        this.emitter.emit(key, value)
        this.alls.emit(key, { key, previousValue, value })
      }
    )
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
  set<K extends keyof State>(key: K) {
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

export function createStore<State extends object>(
  initialState: State,
  options: Options = DEFAULT_OPTIONS
): StoreDefinition<State> {
  return new StoreDefinition<State>(initialState, options)
}

export type Effect<State extends object> =
  (store: StoreDefinition<State>) => void

export type EffectAs<States extends {
  [alias: string]: any
}> = (stores: {[K in keyof States]: StoreDefinition<States[K]>}) => void

/**
 * @deprecated Use `Effect` instead.
 */
export type Plugin<State extends object> = Effect<State>

export * from './plugins/withLogger'
export * from './plugins/withReduxDevtools'
export * from './react'
