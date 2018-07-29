import * as React from 'react'
import { createStore, Effect, Store, StoreDefinition, StoreSnapshot } from '..'
import { Subscription } from '../emitter'
import { Diff, getDisplayName } from '../utils'

export type Connect<State extends object> = {
  Container: React.ComponentType<ContainerProps<State>>
  withStore: <
    Props extends {store: Store<State>}
  >(
    Component: React.ComponentType<Props>
  ) => React.ComponentType<Diff<Props, {store: Store<State>}>>
}

export type ContainerProps<State extends object> = {
  effects?: Effect<State>
  initialState?: State
}

export function connectToTree<State extends object>(
  initialState: State,
  effects?: Effect<State>
): Connect<State> {
  let Context = React.createContext({ __MISSING_PROVIDER__: true } as any)

  type ContainerState = {
    storeDefinition: StoreDefinition<State> | null
    storeSnapshot: StoreSnapshot<State> | null
    subscription: Subscription
  }

  class Container extends React.Component<ContainerProps<State>, ContainerState> {
    constructor(props: ContainerProps<State>) {
      super(props)

      // Create store definition from initial state
      let state = props.initialState || initialState
      let storeDefinition = createStore(state)

      // Apply effects?
      let fx = props.effects || effects
      if (fx) {
        fx(storeDefinition)
      }

      this.state = {
        storeDefinition,
        storeSnapshot: storeDefinition.getCurrentSnapshot(),
        subscription: storeDefinition.onAll().subscribe(() =>
          this.setState({ storeSnapshot: storeDefinition.getCurrentSnapshot() })
        )
      }
    }
    componentWillUnmount() {
      this.state.subscription.unsubscribe();
      // Let the state get GC'd.
      // TODO: Find a more elegant way to do this.
      (this.state.storeSnapshot as any).state = null;
      (this.state.storeSnapshot as any).storeDefinition = null;
      (this.state.storeDefinition as any).storeSnapshot = null
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
          throw Error(`Component "${props.displayName}" is not nested in a <Container>. To fix this error, be sure to render the component in a <Container>...</Container> tag.`)
        }
        return props.children(store)
      }}
    </Context.Consumer>

  function withStore<
    Props extends {store: Store<State>},
    PropsWithoutStore = Diff<Props, {store: Store<State>}>
  >(
    Component: React.ComponentType<Props>
  ): React.ComponentType<PropsWithoutStore> {
    let displayName = getDisplayName(Component)
    let f: React.StatelessComponent<PropsWithoutStore> = props =>
      <Consumer displayName={displayName}>
        {store => <Component store={store} {...props} />}
      </Consumer>
    f.displayName = `withStore(${displayName})`
    return f
  }

  return {
    Container,
    withStore
  }
}

function isInitialized<State extends object>(
  store: StoreSnapshot<State> | {__MISSING_PROVIDER__: true}
) {
  return !('__MISSING_PROVIDER__' in store)
}
