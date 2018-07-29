type Options = {
  isDevMode: boolean,
  onCycle(chain: (string | number | symbol)[]): void
}

export type Subscription = {
  unsubscribe(): void
}

export type Observable<A> = {
  subscribe(f: Listener<A>): Subscription
}

type Listener<A> = (value: A) => any

const DEFAULT_OPTIONS: Options = {
  isDevMode: false,
  onCycle(chain) {
    console.error(
      'Error: Cyclical dependency detected. '
      + 'This may cause a stack overflow unless you fix it. '
      + chain.join(' -> ')
    )
  }
}

export class Emitter<Messages extends object> {

  private allListeners: Listener<Messages[keyof Messages]>[] = []
  private listeners: {
    [K in keyof Messages]?: Listener<Messages[K]>[]
  } = {}
  private options: Options
  private callstack = new Set

  constructor(options?: Partial<Options>) {
    this.options = {...DEFAULT_OPTIONS, ...options}
  }
  emit<K extends keyof Messages>(k: K, v: Messages[K]) {
    let { isDevMode, onCycle } = this.options
    if (isDevMode) {
      if (this.callstack.has(k)) {
        onCycle(Array.from(this.callstack).concat(k))
        return this
      } else {
        this.callstack.add(k)
      }
    }
    let listeners = this.listeners[k]
    this.allListeners.forEach(f => f(v))
    if (!listeners) {
      return
    }
    listeners.forEach(f => f(v))
    if (isDevMode) {
      this.callstack.clear()
    }
  }
  on<K extends keyof Messages>(k: K): Observable<Messages[K]> {
    return {
      subscribe: f => {
        if (!(k in this.listeners)) {
          this.listeners[k] = []
        }
        let listeners = this.listeners[k]!
        let index = listeners.push(f)
        return {
          unsubscribe: () => listeners.splice(index, 1)
        }
      }
    }
  }
  all(): Observable<Messages[keyof Messages]> {
    return {
      subscribe: f => {
        let index = this.allListeners.push(f)
        return {
          unsubscribe: () => this.allListeners.splice(index, 1)
        }
      }
    }
  }
}
