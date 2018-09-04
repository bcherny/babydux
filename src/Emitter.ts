import { Observable, Observer } from 'rxjs-observable'

export type ALL = '__ALL__'
const ALL: ALL = '__ALL__'

interface State<Messages extends object> {
  callChain: Set<keyof Messages | ALL>
  observables: Map<keyof Messages | ALL, Observable<any>[]>
  observers: Map<keyof Messages | ALL, Observer<any>[]>
  options: Options<Messages>
}

export type Options<Messages> = {
  onCycle(chain: (keyof Messages | ALL)[]): void
  isDevMode: boolean
}

export class Emitter<Messages extends object> {
  private emitterState: State<Messages>

  constructor(options?: Partial<Options<Messages>>) {
    let DEFAULT_OPTIONS: Options<Messages> = {
      isDevMode: false,
      onCycle(chain) {
        console.error(
          '[typed-rx-emitter] Error: Cyclical dependency detected. ' +
            'This may cause a stack overflow unless you fix it. ' +
            chain.join(' -> ')
        )
      }
    }

    this.emitterState = {
      callChain: new Set(),
      observables: new Map(),
      observers: new Map(),
      options: { ...DEFAULT_OPTIONS, ...options }
    }
  }

  /**
   * Emit an event (silently fails if no listeners are hooked up yet)
   */
  emit<K extends keyof Messages>(key: K, value: Messages[K]): this {
    let { isDevMode, onCycle } = this.emitterState.options
    if (isDevMode) {
      if (this.emitterState.callChain.has(key)) {
        onCycle(Array.from(this.emitterState.callChain).concat(key))
        return this
      } else {
        this.emitterState.callChain.add(key)
      }
    }
    if (this.hasChannel(key)) {
      this.emitOnChannel(key, value)
    }
    if (this.hasChannel(ALL)) {
      this.emitOnChannel(ALL, value)
    }
    if (isDevMode) this.emitterState.callChain.clear()
    return this
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof Messages>(key: K): Observable<Messages[K]> {
    return this.createChannel(key)
  }

  /**
   * Subscribe to all events
   */
  all(): Observable<Messages[keyof Messages]> {
    return this.createChannel(ALL)
  }

  ///////////////////// privates /////////////////////

  private createChannel<K extends keyof Messages>(key: K | ALL) {
    if (!this.emitterState.observers.has(key)) {
      this.emitterState.observers.set(key, [])
    }
    if (!this.emitterState.observables.has(key)) {
      this.emitterState.observables.set(key, [])
    }
    const observable: Observable<Messages[K]> = new Observable(_ => {
      this.emitterState.observers.get(key)!.push(_)
      return () => this.deleteChannel(key, observable)
    })
    this.emitterState.observables.get(key)!.push(observable)
    return observable
  }

  private deleteChannel<K extends keyof Messages>(
    key: K | ALL,
    observable: Observable<Messages[K]>
  ) {
    if (!this.emitterState.observables.has(key)) {
      return
    }
    const array = this.emitterState.observables.get(key)!
    const index = array.indexOf(observable)
    if (index < 0) {
      return
    }
    array.splice(index, 1)
    if (!array.length) {
      this.emitterState.observables.delete(key)
      this.emitterState.observers.delete(key)
    }
  }

  private emitOnChannel<K extends keyof Messages>(
    key: K | ALL,
    value: Messages[K]
  ) {
    this.emitterState.observers.get(key)!.forEach(_ => _.next(value))
  }

  private hasChannel<K extends keyof Messages>(key: K | ALL): boolean {
    return this.emitterState.observables.has(key)
  }
}
