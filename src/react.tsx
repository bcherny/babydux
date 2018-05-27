import * as React from 'react'
import { ComponentClass } from 'react'
import { Subscription } from 'rxjs'
import { Store, StoreDefinition, StoreSnapshot } from './'
import { equals, getDisplayName, Omit } from './utils'

export function connect<Actions extends object>(
  store: StoreDefinition<Actions> | Omit<StoreDefinition<Actions>, 'set'>
) {
  return function <
    Props,
    PropsWithStore extends { store: Store<Actions> } & Props = { store: Store<Actions> } & Props
    >(
      Component: React.ComponentType<PropsWithStore>
    ): React.ComponentClass<Omit<PropsWithStore, 'store'>> {

    type State = {
      store: StoreSnapshot<Actions>
      subscription: Subscription
    }

    return class extends React.Component<Omit<PropsWithStore, 'store'>, State> {
      static displayName = `withStore(${getDisplayName(Component)})`
      state = {
        store: (store as StoreDefinition<Actions>)['store'],
        subscription: (store as StoreDefinition<Actions>).onAll().subscribe(({ key, previousValue, value }) => {
          if (equals(previousValue, value)) {
            return false
          }
          this.setState({ store: (store as StoreDefinition<Actions>)['store'] })
        })
      }
      componentWillUnmount() {
        this.state.subscription.unsubscribe()
      }
      shouldComponentUpdate(props: Omit<PropsWithStore, 'store'>, state: State) {
        return state.store !== this.state.store
          || Object.keys(props).some(_ => (props as any)[_] !== (this.props as any)[_])
      }
      render() {
        return <Component {...this.props} store={this.state.store} />
      }
    }
  }
}
