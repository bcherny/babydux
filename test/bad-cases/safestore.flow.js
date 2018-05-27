// @flow
import { connect, createStore, createSafeStore, withLogger, withReduxDevtools } from '../../dist/src'
import type { Plugin, SafePlugin, Store } from '../../dist/src'
import * as React from 'react'
import { debounceTime, filter } from 'rxjs/operators'

type State = {|
  isTrue: boolean,
  users: string[]
|}

let initialState: State = {
  isTrue: true,
  users: []
}

let withSafeEffects: SafePlugin<State> = store => {
  store.onAll().subscribe(({ key, value, previousValue }) => {
    key.toUpperCase()
    if (typeof previousValue === 'boolean' || typeof value === 'boolean') {
      !previousValue
      !value
    } else {
      previousValue.slice(0, 1)
      value.slice(0, 1)
    }
  })
  store.on('users').subscribe(_ => {
    _.slice(0, 1)
    store.set('isTrue')(!store.get('isTrue')) // ERROR
  })
  return store
}

let safeStore = withSafeEffects(createSafeStore(initialState))

type Props = {|
  foo: number,
  bar: string
|}

type StoreProps = {|
  store: Store<State>
|}

type PropsWithStore = {|
  ...StoreProps,
  ...Props
|}

let S = connect(safeStore)(class extends React.Component<PropsWithStore> {
  render() {
    return <div>
      {this.props.store.get('isTrue') ? 'True' : 'False'}
      {this.props.foo}
      {this.props.bar}
      <button onClick={this.props.store.set('isTrue')(true)} />
    </div>
  }
})
let s = <S foo={1} bar='baz' />