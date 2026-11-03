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

/** Why the quantity of a product changed. The server decides `initial` and `removed`. */
export type MovementReason = "purchase" | "consume" | "waste" | "adjust";

/** Where a stock change came from. The server writes `migration` and `undo` itself. */
export type MovementSource = "app" | "scan" | "shopping_list" | "device" | "ticket" | "review";

export interface InventoryPatch {
  reason?: MovementReason;
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

/** What a scanned code does to the stock. */
export type ScanMode = "purchase" | "consume";

/** What happened when a code was scanned. */
export type ScanStatus = "applied" | "created" | "already_empty" | "not_tracked" | "unknown";

export interface ScanRequest {
  ean: string;
  mode: ScanMode;
  location?: Location;
}

export interface ScanResult {
  status: ScanStatus;
  mode: ScanMode;
  ean: string;
  name?: string | null;
  image_url?: string | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  unit?: string | null;
  movement_id?: number | null;
  low?: boolean | null;
}

/** One change of the stock, as the diary returns it. */
export interface MovementOut {
  id: number;
  ean: string;
  delta: number;
  quantity_after: number;
  reason: string;
  source: string;
  price?: number | null;
  undoes_id?: number | null;
  undone: boolean;
  created_at: string;
}

/** Why the weekly review asks about a product. */
export type ReviewReason = "overdue" | "stale";

export interface ReviewCandidate {
  ean: string;
  name: string;
  brand?: string | null;
  image_url?: string | null;
  quantity: number;
  unit: string;
  reason: ReviewReason;
  estimated_empty_on?: string | null;
  days_since_activity: number;
}
