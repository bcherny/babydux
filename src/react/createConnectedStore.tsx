import * as React from 'react'
import { createConnectedStoreAs, Effects, Store } from '..'
import { Diff } from '../utils'

export type Connect<State extends object> = {
  Container: React.ComponentType<ContainerProps<State>>
  withStore: <Props extends { store: Store<State> }>(
    Component: React.ComponentType<Props>
  ) => React.ComponentType<Diff<Props, { store: Store<State> }>>
}

export type ContainerProps<State extends object> = {
  effects?: Effects<State>
  initialState?: State
}

export function createConnectedStore<State extends object>(
  initialState: State,
  effects?: Effects<State>
): Connect<State> {
  let { Container, withStores } = createConnectedStoreAs(
    {
      store: initialState
    },
    s => {
      if (effects) {
        effects(s.store)
      }
      return s
    }
  )
  return {
    Container: Container as any,
    withStore: withStores
  }
}
