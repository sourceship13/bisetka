/**
 * Frontend wrapper around `react-native-iap`.
 *
 * Responsibilities:
 *   - Initialize the StoreKit / Play Billing connection on app start.
 *   - Fetch product metadata (localised price strings) for points packs +
 *     clothing tiers.
 *   - Run a one-shot purchase flow for either a points pack or a clothing
 *     item, validating the receipt server-side via apiService.
 *   - Centralise the price-tier mapping so the catalogue can keep arbitrary
 *     per-item prices while the store only sees a small SKU set.
 */

import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import apiService from './api.service';

// ─── SKUs (must match App Store Connect / Play Console) ─────────────────────
export const POINTS_SKUS = [
  '299',
  '399',
  '599',
  '1099',
] as const;
export type PointsSKU = typeof POINTS_SKUS[number];

export const CLOTHING_TIER_SKUS = [
  '199',
  'c399',
  'c599',
  'c1099',
] as const;
export type ClothingTierSKU = typeof CLOTHING_TIER_SKUS[number];

const ALL_SKUS = [...POINTS_SKUS, ...CLOTHING_TIER_SKUS];

const TIER_USD: { sku: ClothingTierSKU; price: number }[] = [
  { sku: '199', price: 1.99 },
  { sku: 'c399', price: 3.99 },
  { sku: 'c599', price: 5.99 },
  { sku: 'c1099', price: 10.99 },
];

function normalizePurchaseError(error: any, sku: string): Error {
  const rawMessage = String(error?.message || 'Purchase failed');
  const code = String(error?.code || '').trim();

  if (code === 'E_SKU_NOT_FOUND') {
    return new Error(
      `Store product not available for SKU ${sku}. Check App Store/Play product setup and tester account.`
    );
  }

  if (rawMessage.includes('status=21002')) {
    return new Error(
      'Receipt verification failed (Apple status 21002). If running from Xcode with a local StoreKit file, disable StoreKit Configuration or use sandbox/TestFlight receipts.'
    );
  }

  if (rawMessage.toLowerCase().includes('network request failed')) {
    return new Error('Could not reach purchase verification server. Please check network/API host and try again.');
  }

  if (rawMessage.includes('Unknown product tier')) {
    return new Error(`Server does not recognize product tier ${sku}. Verify backend SKU tier configuration.`);
  }

  if (rawMessage.includes('Tier') && rawMessage.includes('below item price')) {
    return new Error('Selected purchase tier is below the clothing item price. Refresh the app and try again.');
  }

  if (code) {
    return new Error(`${rawMessage} [${code}]`);
  }

  return new Error(rawMessage);
}

export function getPurchaseErrorMessage(error: any, fallback: string = 'Purchase failed'): string {
  const message = String(error?.message || error?.error || fallback).trim();
  const code = error?.code ? String(error.code) : '';
  const status =
    typeof error?.status === 'number'
      ? String(error.status)
      : typeof error?.response?.status === 'number'
      ? String(error.response.status)
      : '';

  const details: string[] = [];
  if (code) details.push(`Code: ${code}`);
  if (status) details.push(`Status: ${status}`);

  if (details.length === 0 && (message === fallback || message === 'Purchase failed')) {
    return `${fallback}. Please check store configuration/test account and backend verification settings.`;
  }

  return details.length > 0 ? `${message}\n${details.join(' · ')}` : message;
}

/**
 * Map an item's per-item display price (in cents) to the smallest tier SKU
 * that fully covers it.
 */
export function tierForClothingPriceCents(priceCents: number): ClothingTierSKU {
  const usd = Math.max(0, priceCents) / 100;
  for (const t of TIER_USD) {
    if (t.price >= usd - 0.001) return t.sku;
  }
  return 'c1099';
}

// ─── Connection lifecycle ────────────────────────────────────────────────────
let initialized = false;
let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

/**
 * Initialize the IAP connection. Safe to call multiple times; subsequent
 * calls are no-ops.
 */
export async function initIAP(): Promise<void> {
  if (initialized) return;
  try {
    await RNIap.initConnection();
    // Android: clear stale, unfinished transactions left behind by crashes.
    if (Platform.OS === 'android') {
      try {
        await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
      } catch {}
    }
    initialized = true;
    console.log('🛒 IAP connection initialised');
  } catch (e: any) {
    console.warn('🛒 IAP init failed:', e?.message);
  }
}

export async function endIAP(): Promise<void> {
  try {
    purchaseUpdateSub?.remove();
    purchaseErrorSub?.remove();
    purchaseUpdateSub = null;
    purchaseErrorSub = null;
    if (initialized) {
      await RNIap.endConnection();
    }
  } finally {
    initialized = false;
  }
}

// ─── Product catalogue ───────────────────────────────────────────────────────
let productCache: Record<string, RNIap.Product> | null = null;

export async function getProducts(): Promise<Record<string, RNIap.Product>> {
  if (productCache && Object.keys(productCache).length > 0) return productCache;
  await initIAP();
  try {
    const products = await RNIap.getProducts({ skus: ALL_SKUS as unknown as string[] });
    productCache = {};
    products.forEach((p) => {
      productCache![p.productId] = p;
    });
    console.log(`🛍 getProducts: ${products.length}/${ALL_SKUS.length} SKUs returned`, products.map(p => p.productId));
    return productCache;
  } catch (e: any) {
    console.warn('🛍 getProducts failed:', e?.code, e?.message);
    return {};
  }
}

/** Localised price string (e.g. "$0.99") for a SKU, falling back to fallback. */
export async function getLocalizedPrice(
  sku: string,
  fallback: string,
): Promise<string> {
  const products = await getProducts();
  return products[sku]?.localizedPrice || fallback;
}

// ─── Purchase flow ───────────────────────────────────────────────────────────

interface IapResult {
  productId: string;
  transactionId: string;
  appleReceipt?: string;
  googlePurchaseToken?: string;
  purchase: RNIap.ProductPurchase;
}

/**
 * Buy a single product, wait for the platform transaction to complete, and
 * return the receipt fields needed for server-side verification.
 *
 * Uses one-shot purchaseUpdatedListener / purchaseErrorListener pair so this
 * function resolves exactly once per call.
 */
function purchaseOnce(sku: string): Promise<IapResult> {
  return new Promise<IapResult>(async (resolve, reject) => {
    let settled = false;
    let updateSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    const cleanup = () => {
      try { updateSub?.remove(); } catch {}
      try { errorSub?.remove(); } catch {}
    };

    const settleOk = (r: IapResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(r);
    };
    const settleErr = (e: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    };

    updateSub = RNIap.purchaseUpdatedListener(async (p: RNIap.ProductPurchase) => {
      if (p.productId !== sku) return;
      const appleReceipt =
        (p as any).transactionReceipt || (p as any).receipt || undefined;
      const googlePurchaseToken = (p as any).purchaseToken;
      const transactionId =
        (p as any).transactionId || (p as any).orderId || googlePurchaseToken || '';
      settleOk({
        productId: p.productId,
        transactionId: String(transactionId),
        appleReceipt,
        googlePurchaseToken,
        purchase: p,
      });
    });

    errorSub = RNIap.purchaseErrorListener((err: RNIap.PurchaseError) => {
      // E_USER_CANCELLED is a normal flow; surface as a typed error.
      const code = err.code || 'UNKNOWN';
      const cancelled = code === 'E_USER_CANCELLED';
      const baseMsg = err.message || 'Purchase failed';
      const e: any = new Error(cancelled ? baseMsg : `${baseMsg} [${code}]`);
      e.code = code;
      e.cancelled = cancelled;
      console.warn('🛍 purchaseErrorListener:', code, baseMsg, err);
      settleErr(e);
    });

    try {
      await initIAP();
      // Pre-flight: make sure the SKU is actually in the store catalogue.
      // If StoreKit/Play returns nothing for this SKU, requestPurchase will
      // fail with a vague error — surface a clearer one instead.
      const products = await getProducts();
      if (!products[sku]) {
        const missingErr: any = new Error(
          `Product "${sku}" not available in the store. ` +
          (Platform.OS === 'ios'
            ? 'On iOS this usually means the SKU is missing/unapproved in App Store Connect, the device is a Simulator, or you are not signed into a Sandbox Apple ID.'
            : 'On Android the app must be installed from a Play Store testing track (internal/closed/open) and the SKU must be Active in the Play Console.')
        );
        missingErr.code = 'E_SKU_NOT_FOUND';
        settleErr(missingErr);
        return;
      }
      await RNIap.requestPurchase({ sku, andDangerouslyFinishTransactionAutomaticallyIOS: false });
    } catch (e: any) {
      console.warn('🛍 requestPurchase threw:', e?.code, e?.message);
      settleErr(e);
    }
  });
}

/** Tell the store the receipt was redeemed so it stops re-delivering it. */
async function finishPurchase(purchase: RNIap.ProductPurchase) {
  try {
    await RNIap.finishTransaction({ purchase, isConsumable: true });
  } catch (e: any) {
    console.warn('🛒 finishTransaction failed:', e?.message);
  }
}

// ─── High-level purchase API ─────────────────────────────────────────────────

export interface PointsVerifyResponse {
  success: boolean;
  productId?: string;
  pointsAdded: number;
  basePoints?: number;
  bonusPoints?: number;
  newBalance: number;
  transactionId?: string;
  alreadyApplied?: boolean;
  error?: string;
}

/**
 * Buy a points pack end-to-end:
 *   StoreKit/Play purchase -> backend receipt verify -> finish transaction.
 */
export async function buyPointsPack(sku: PointsSKU): Promise<PointsVerifyResponse> {
  let result: IapResult;
  try {
    result = await purchaseOnce(sku);
  } catch (error: any) {
    throw normalizePurchaseError(error, sku);
  }

  let verify: PointsVerifyResponse;
  try {
    verify = await apiService.verifyPointsPurchase({
      productId: result.productId,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appleReceipt: result.appleReceipt,
      googlePurchaseToken: result.googlePurchaseToken,
    });
  } catch (error: any) {
    throw normalizePurchaseError(error, sku);
  }

  if (!verify.success) {
    throw normalizePurchaseError(new Error(verify.error || 'Points purchase verification failed'), sku);
  }

  // Only finish if server accepted; otherwise leave it pending so it will
  // be retried next launch.
  if (verify.success) {
    await finishPurchase(result.purchase);
  }
  return verify;
}

export interface ClothingVerifyResponse {
  success: boolean;
  productId: string;
  clothingId: string;
  clothingType: string | null;
  equipped: boolean;
  alreadyApplied?: boolean;
  error?: string;
}

/**
 * Buy a single clothing item. Maps its display price to the right tier SKU,
 * triggers the platform purchase, then asks the backend to grant + auto-equip.
 */
export async function buyClothingItem(args: {
  clothingId: string;
  clothingType: string;
  priceCents: number;
}): Promise<ClothingVerifyResponse> {
  const sku = tierForClothingPriceCents(args.priceCents);
  let result: IapResult;
  try {
    result = await purchaseOnce(sku);
  } catch (error: any) {
    throw normalizePurchaseError(error, sku);
  }

  let verify: ClothingVerifyResponse;
  try {
    verify = await apiService.verifyClothingPurchase({
      productId: result.productId,
      clothingId: args.clothingId,
      clothingType: args.clothingType,
      clothingPriceCents: args.priceCents,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appleReceipt: result.appleReceipt,
      googlePurchaseToken: result.googlePurchaseToken,
    });
  } catch (error: any) {
    throw normalizePurchaseError(error, sku);
  }

  if (!verify.success) {
    throw normalizePurchaseError(new Error(verify.error || 'Clothing purchase verification failed'), sku);
  }

  if (verify.success) {
    await finishPurchase(result.purchase);
  }
  return verify;
}

export default {
  initIAP,
  endIAP,
  getProducts,
  getLocalizedPrice,
  buyPointsPack,
  buyClothingItem,
  tierForClothingPriceCents,
};
