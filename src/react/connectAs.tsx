import * as React from 'react'
import { Subscription } from 'rxjs-observable'
import { StoreDefinition } from '../'
import { Diff, equals, getDisplayName, keys, mapValues, some } from '../utils'

/**
 * @deprecated Use `createConnectedStoreAs` instead.
 */
export function connectAs<
  Stores extends { [alias: string]: StoreDefinition<any> }
>(stores: Stores) {
  return function<Props extends object>(
    Component: React.ComponentType<
      { [K in keyof Stores]: ReturnType<Stores[K]['toStore']> } & Props
    >
  ): React.ComponentClass<Diff<Props, Stores>> {
    type State = {
      stores: {
        [K in keyof Stores]: ReturnType<Stores[K]['getCurrentSnapshot']>
      }
      subscriptions: Subscription[]
    }

    return class extends React.Component<Diff<Props, Stores>, State> {
      static displayName = `withStore(${getDisplayName(Component)})`
      state = {
        stores: mapValues(
          stores,
          _ =>
            _.getCurrentSnapshot() as ReturnType<
              (typeof _)['getCurrentSnapshot']
            >
        ),
        subscriptions: keys(stores).map(
          k =>
            stores[k].onAll().subscribe(({ previousValue, value }) => {
              if (equals(previousValue, value)) {
                return false
              }
              this.setState({
                stores: Object.assign({}, this.state.stores as any, {
                  [k]: stores[k].getCurrentSnapshot()
                })
              })
            }) as any
        )
      }
      componentWillUnmount() {
        this.state.subscriptions.forEach(_ => _.unsubscribe())
      }
      shouldComponentUpdate(props: Diff<Props, Stores>, state: State) {
        return (
          some(state.stores, (s, k) => s !== this.state.stores[k]) ||
          Object.keys(props).some(
            _ => (props as any)[_] !== (this.props as any)[_]
          )
        )
      }
      render() {
        return <Component {...this.props} {...this.state.stores} />
      }
    }
  }
}
