export const queryKeys = {
  inventory: (low?: boolean) => ["inventory", { low }] as const,
  shoppingList: () => ["shopping-list"] as const,
  products: (q: string) => ["products", { q }] as const,
};
