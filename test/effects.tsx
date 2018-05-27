import { test } from 'ava'
import * as React from 'react'
import { Simulate } from 'react-dom/test-utils'
import { connect, createStore, Plugin, SafePlugin } from '../src'
import { withElement } from './testUtils'

test('[effects] Plugin', t => {
  type State = {
    a: number
    b: number
  }
  t.plan(3)
  let withStore: Plugin<State> = store => {
    store.onAll().subscribe(_ => {
      t.is(_.key, 'a')
      t.is(_.value, 3)
      t.is(_.previousValue, 1)
    })
    return store
  }
  let store = withStore(createStore<State>({
    a: 1,
    b: 2
  }))
  store.set('a')(3)
})

test('[effects] SafePlugin', t => {
  type State = {
    a: number
    b: number
  }
  t.plan(15)
  let withStore: SafePlugin<State> = store => {
    let i = 0
    store.onAll().subscribe(_ => {
      switch (i) {
        case 0:
          t.is(_.key, 'a')
          t.is(_.value, 2)
          t.is(_.previousValue, 1)
          break
        case 1:
          t.is(_.key, 'b')
          t.is(_.value, 3)
          t.is(_.previousValue, 2)
          break
        case 2:
          t.is(_.key, 'b')
          t.is(_.value, 4)
          t.is(_.previousValue, 3)
      }
      i++
    })
    return store
  }
  let store = withStore(createStore<State>({
    a: 1,
    b: 2
  }))
  let MyComponent = connect(store)(({ store }) =>
    <>
      a = {store.get('a')}
      b = {store.get('b')}
      <button id='a' onClick={() => store.set('a')(store.get('a') + 1)}>a + 1</button>
      <button id='b' onClick={() => store.set('b')(store.get('b') + 1)}>b + 1</button>
    </>
  )
  withElement(MyComponent, _ => {
    // a
    Simulate.click(_.querySelector('#a')!)
    t.is(store.get('a'), 2)
    t.regex(_.innerHTML, /a = 2/)

    // b
    Simulate.click(_.querySelector('#b')!)
    t.is(store.get('b'), 3)
    t.regex(_.innerHTML, /b = 3/)

    // b again
    Simulate.click(_.querySelector('#b')!)
    t.is(store.get('b'), 4)
    t.regex(_.innerHTML, /b = 4/)
  })
})
