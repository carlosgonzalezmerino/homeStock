/** Central place for react-query cache keys, so invalidation and reads cannot drift apart. */
export const queryKeys = {
  inventory: (low?: boolean) => ["inventory", { low }] as const,
  shoppingList: () => ["shopping-list"] as const,
  products: (query: string) => ["products", { q: query }] as const,
  resolve: (ean: string) => ["resolve", ean] as const,
};
