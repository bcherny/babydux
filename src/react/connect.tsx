import { connectAs, StoreDefinition } from '../'

/**
 * @deprecated Use `createConnectedStore` instead.
 */
export function connect<StoreState extends object>(
  store: StoreDefinition<StoreState>
) {
  return connectAs({ store })
}
