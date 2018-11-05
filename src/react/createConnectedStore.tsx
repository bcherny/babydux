import * as React from 'react'
import { Subscription } from 'rxjs'
import { createStore, Effects, Store, StoreDefinition, StoreSnapshot } from '..'
import { Diff, getDisplayName } from '../utils'

export type Connect<State extends object> = {
  Container: React.ComponentType<ContainerProps<State>>
  useStore<K extends keyof State>(field: K): [Readonly<State[K]>, (value: State[K]) => void]
  withStore: <
    Props extends {store: Store<State>}
  >(
    Component: React.ComponentType<Props>
  ) => React.ComponentType<Diff<Props, {store: Store<State>}>>
}

export type ContainerProps<State extends object> = {
  effects?: Effects<State>
  initialState?: State
}

export function createConnectedStore<State extends object>(
  initialState: State,
  effects?: Effects<State>
): Connect<State> {
  let Context = React.createContext({ __MISSING_PROVIDER__: true } as any)

  type ContainerState = {
    storeSnapshot: StoreSnapshot<State>
  }

  class Container extends React.Component<ContainerProps<State>, ContainerState> {
    subscription: Subscription
    storeDefinition: StoreDefinition<State>
    constructor(props: ContainerProps<State>) {
      super(props)

      // Create store definition from initial state
      let state = props.initialState || initialState
      this.storeDefinition = createStore(state)

      // Apply effects?
      let fx = props.effects || effects
      if (fx) {
        fx(this.storeDefinition)
      }

      this.state = {
        storeSnapshot: this.storeDefinition.getCurrentSnapshot()
      }

      this.subscription = this.storeDefinition.onAll().subscribe(() =>
        this.setState({ storeSnapshot: this.storeDefinition.getCurrentSnapshot() })
      )
    }
    componentWillUnmount() {
      this.subscription.unsubscribe();
      // Let the state get GC'd.
      // TODO: Find a more elegant way to do this.
      (this.storeDefinition as any).storeSnapshot = null;
      (this as any).storeDefinition = null
    }
    render() {
      return <Context.Provider value={this.state.storeSnapshot}>
        {this.props.children}
      </Context.Provider>
    }
  }

  let Consumer = (props: {
    children: (store: StoreSnapshot<State>) => JSX.Element
    displayName: string
  }) =>
    <Context.Consumer>
      {store => {
        if (!isInitialized(store)) {
          throw Error(`[Undux] Component "${props.displayName}" does not seem to be nested in an Undux <Container>. To fix this error, be sure to render the component in the <Container>...</Container> component that you got back from calling createConnectedStore().`)
        }
        return props.children(store)
      }}
    </Context.Consumer>

  function useStore<K extends keyof State>(field: K) {
    let store = (React as any).useContext(Context) as Store<State>
    assertInitialized(store, 'Component')
    return [store.get(field), store.set(field)] as [
      State[K],
      (field: State[K]) => void
    ]
  }

  function withStore<
    Props extends {store: Store<State>},
    PropsWithoutStore = Diff<Props, {store: Store<State>}>
  >(
    Component: React.ComponentType<Props>
  ): React.ComponentType<PropsWithoutStore> {
    let displayName = getDisplayName(Component)
    let f: React.StatelessComponent<PropsWithoutStore> = props =>
      <Consumer displayName={displayName}>
        {storeSnapshot => <Component store={storeSnapshot} {...props} />}
      </Consumer>
    f.displayName = `withStore(${displayName})`
    return f
  }

  return {
    Container,
    useStore,
    withStore
  }
}

function assertInitialized<State extends object>(
  store: Store<State> | {__MISSING_PROVIDER__: true},
  displayName: string
): store is Store<State> {
  if (!isInitialized(store)) {
    throw Error(`[Undux] Component "${displayName}" does not seem to be nested in an Undux <Container>. To fix this error, be sure to render the component in the <Container>...</Container> component that you got back from calling createConnectedStore().`)
  }
  return true
}

function isInitialized<State extends object>(
  store: Store<State> | {__MISSING_PROVIDER__: true}
) {
  return !('__MISSING_PROVIDER__' in store)
}
