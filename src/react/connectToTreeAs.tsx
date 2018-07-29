import * as React from 'react'
import { createStore, EffectAs, Store, StoreDefinition, StoreSnapshot } from '..'
import { Subscription } from '../emitter'
import { Diff, getDisplayName, mapValues } from '../utils'

export type ConnectAs<States extends {
  [alias: string]: any
}> = {
  Container: React.ComponentType<ContainerPropsAs<States>>
  initialStates: States,
  withStores: <
    Props extends {[K in keyof States]: Store<States[K]>}
  >(
    Component: React.ComponentType<Props>
  ) => React.ComponentType<Diff<Props, {[K in keyof States]: Store<States[K]>}>>
}

export type ContainerPropsAs<States extends {
  [alias: string]: any
}> = {
  effects?: EffectAs<States>
  initialStates?: States
}

export function connectToTreeAs<States extends {
  [alias: string]: any
}>(
  initialStates: States,
  effects?: EffectAs<States>
): ConnectAs<States> {
  let Context = React.createContext({ __MISSING_PROVIDER__: true } as any)

  type ContainerState = {
    storeDefinitions: {
      [K in keyof States]: StoreDefinition<States[K]> | null
    }
    storeSnapshots: {
      [K in keyof States]: StoreSnapshot<States[K]> | null
    }
    subscriptions: {
      [K in keyof States]: Subscription
    }
  }

  class Container extends React.Component<ContainerPropsAs<States>, ContainerState> {
    constructor(props: ContainerPropsAs<States>) {
      super(props)

      // Create store definition from initial state
      let states = props.initialStates || initialStates
      let stores = mapValues(states, _ => createStore(_))

      // Apply effects?
      let fx = props.effects || effects
      if (fx) {
        fx(stores)
      }

      this.state = {
        storeDefinitions: stores,
        storeSnapshots: mapValues(stores, _ => _.getCurrentSnapshot()),
        subscriptions: mapValues(stores, (_, k) => _.onAll().subscribe(() =>
          this.setState({
            storeSnapshots: Object.assign(
              {},
              this.state.storeSnapshots,
              { [k]: _.getCurrentSnapshot() }
            )
          })
        ))
      }
    }
    componentWillUnmount() {
      mapValues(this.state.subscriptions, _ => _.unsubscribe())
      // Let the state get GC'd.
      // TODO: Find a more elegant way to do this.
      if (this.state.storeSnapshots) {}
      mapValues(this.state.storeSnapshots, _ => (_ as any).state = null)
      mapValues(this.state.storeSnapshots, _ => (_ as any).storeDefinition = null)
      mapValues(this.state.storeDefinitions, _ => (_ as any).storeSnapshot = null)
    }
    render() {
      return <Context.Provider value={this.state.storeSnapshots}>
        {this.props.children}
      </Context.Provider>
    }
  }

  let Consumer = (props: {
    children: (stores: { [K in keyof States]: StoreSnapshot<States[K]> }) => JSX.Element
    displayName: string
  }) =>
    <Context.Consumer>
      {stores => {
        mapValues(stores, (store: StoreSnapshot<any>) => {
          if (!isInitialized(store)) {
            throw Error(`Component "${props.displayName}" is not nested in a <Container>. To fix this error, be sure to render the component in a <Container>...</Container> tag.`)
          }
        })
        return props.children(stores)
      }}
    </Context.Consumer>

  function withStores<
    Props extends {[K in keyof States]: Store<States[K]>},
    PropsWithoutStore = Diff<Props, {[K in keyof States]: Store<States[K]>}>
  >(
    Component: React.ComponentType<Props>
  ): React.ComponentType<PropsWithoutStore> {
    let displayName = getDisplayName(Component)
    let f: React.StatelessComponent<PropsWithoutStore> = props =>
      <Consumer displayName={displayName}>
        {stores => <Component {...stores} {...props} />}
      </Consumer>
    f.displayName = `withStores(${displayName})`
    return f
  }

  return {
    Container,
    initialStates,
    withStores
  }
}

function isInitialized<State extends object>(
  store: StoreSnapshot<State> | {__MISSING_PROVIDER__: true}
) {
  return !('__MISSING_PROVIDER__' in store)
}
