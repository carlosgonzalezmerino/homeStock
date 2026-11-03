export interface Nutrition {
  kcal_per_100g?: number | null;
  fat_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  carbs_per_100g?: number | null;
  sugars_per_100g?: number | null;
  fiber_per_100g?: number | null;
  proteins_per_100g?: number | null;
  salt_per_100g?: number | null;
}

export interface ProductOut extends Nutrition {
  ean: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_desc?: string | null;
  source: string;
}

export interface ProductCreate extends Nutrition {
  ean: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_desc?: string | null;
}

export interface InventoryOut {
  id: number;
  ean: string;
  quantity: number;
  threshold: number;
  unit: string;
  location?: string | null;
  drawer?: number | null;
  frozen_at?: string | null;
  notes?: string | null;
}

export interface InventoryCreate {
  ean: string;
  quantity: number;
  threshold: number;
  unit?: string;
  location?: Location | null;
  drawer?: number | null;
  frozen_at?: string | null;
  notes?: string | null;
}

export interface InventoryPatch {
  quantity?: number;
  threshold?: number;
  unit?: string;
  location?: Location | null;
  drawer?: number | null;
  frozen_at?: string | null;
  notes?: string | null;
}

export interface InventoryWithProductOut {
  inventory: InventoryOut;
  product: ProductOut;
  low: boolean;
}

export interface ShoppingListItemOut {
  ean: string;
  name: string;
  quantity: number;
  threshold: number;
  unit: string;
  image_url?: string | null;
}

export type Location = "pantry" | "freezer";
