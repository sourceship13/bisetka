import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import RNFS from 'react-native-fs';
import apiService from '../services/api.service';

const defaultBackground = require('../../assets/backgrounds/bisetka.png');
const backgroundCache = new Map<string, string>();
const BACKGROUND_STORAGE_KEY = '@bisetka:background-cache:v1';
const BACKGROUND_CACHE_DIR = `${RNFS.CachesDirectoryPath}/bisetka-backgrounds`;

// ── Startup preload ────────────────────────────────────────────────────────────
// Warm the in-memory cache from AsyncStorage + validate each file still exists.
// Stale file:// URIs (after reinstall) are evicted so ImageBackground never
// gets a dead URI and shows white.
AsyncStorage.getItem(BACKGROUND_STORAGE_KEY)
  .then(async stored => {
    if (!stored) return;
    const parsed = JSON.parse(stored) as Record<string, PersistedBackgroundCacheEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    const validEntries: Record<string, PersistedBackgroundCacheEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry?.localUri) continue;
      try {
        const filePath = entry.localUri.replace('file://', '');
        const exists = await RNFS.exists(filePath);
        if (exists) {
          backgroundCache.set(key, entry.localUri);
          validEntries[key] = entry;
        } else {
          console.log('[useBisetkaBackground] evicting stale cache entry:', key);
        }
      } catch { /* skip */ }
    }
    // Rewrite storage with only valid entries
    await AsyncStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(validEntries));
  })
  .catch(() => { /* silent — fallback to default bg */ });

export const DEFAULT_BISETKA_BACKGROUND_PROMPT =
  'a hyperrealistic photo of a bisetka in {locale} and looks really pretty with iconography of {city}';

type PersistedBackgroundCacheEntry = {
  localUri: string;
  remoteUrl: string;
  savedAt: string;
};

const hashCacheKey = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const getBackgroundFilePath = (cacheKey: string, sourceUrl: string) => {
  const extensionMatch = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extensionMatch?.[1]?.toLowerCase() || 'jpg';
  return `${BACKGROUND_CACHE_DIR}/${hashCacheKey(cacheKey)}.${extension}`;
};

const readPersistedBackgroundCache = async (): Promise<Record<string, PersistedBackgroundCacheEntry>> => {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored) as Record<string, PersistedBackgroundCacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('⚠️ [useBisetkaBackground] Failed to read cached backgrounds:', error);
    return {};
  }
};

const writePersistedBackgroundCache = async (cache: Record<string, PersistedBackgroundCacheEntry>) => {
  try {
    await AsyncStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('⚠️ [useBisetkaBackground] Failed to persist cached backgrounds:', error);
  }
};

const getPersistedBackground = async (cacheKey: string): Promise<PersistedBackgroundCacheEntry | null> => {
  const cache = await readPersistedBackgroundCache();
  const entry = cache[cacheKey];

  if (!entry?.localUri) {
    return null;
  }

  const filePath = entry.localUri.replace('file://', '');
  const exists = await RNFS.exists(filePath);
  if (exists) {
    return entry;
  }

  delete cache[cacheKey];
  await writePersistedBackgroundCache(cache);
  return null;
};

const persistBackgroundLocally = async (cacheKey: string, remoteUrl: string) => {
  try {
    await RNFS.mkdir(BACKGROUND_CACHE_DIR);
    const destinationPath = getBackgroundFilePath(cacheKey, remoteUrl);
    const downloadResult = await RNFS.downloadFile({
      fromUrl: remoteUrl,
      toFile: destinationPath,
      background: true,
      discretionary: true,
    }).promise;

    if (downloadResult.statusCode && downloadResult.statusCode >= 400) {
      throw new Error(`Download failed with status ${downloadResult.statusCode}`);
    }

    const localUri = `file://${destinationPath}`;
    const cache = await readPersistedBackgroundCache();
    const previousEntry = cache[cacheKey];
    cache[cacheKey] = {
      localUri,
      remoteUrl,
      savedAt: new Date().toISOString(),
    };
    await writePersistedBackgroundCache(cache);

    if (previousEntry?.localUri && previousEntry.localUri !== localUri) {
      const previousPath = previousEntry.localUri.replace('file://', '');
      if (await RNFS.exists(previousPath)) {
        await RNFS.unlink(previousPath);
      }
    }

    return localUri;
  } catch (error) {
    console.warn('⚠️ [useBisetkaBackground] Failed to save background locally:', error);
    return remoteUrl;
  }
};

type UseBisetkaBackgroundOptions = {
  city?: string | null;
  neighborhood?: string | null;
  country?: string | null;
  cacheKey?: string | null;
  promptTemplate?: string;
  enabled?: boolean;
  forceReload?: boolean; // Force regeneration even if cached
};

const useBisetkaBackground = ({
  city,
  neighborhood,
  country,
  cacheKey,
  promptTemplate = DEFAULT_BISETKA_BACKGROUND_PROMPT,
  enabled = true,
  forceReload = false,
}: UseBisetkaBackgroundOptions) => {
  // Lazy initializer: if the startup preloader already warmed backgroundCache
  // with this cacheKey, use it immediately — first render shows the image.
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(() => {
    if (!cacheKey) return null;
    const effectiveKey = `${cacheKey}::${promptTemplate}`;
    return backgroundCache.get(effectiveKey) ?? backgroundCache.get(cacheKey) ?? null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBackground = async () => {
      const trimmedCity = city?.trim();
      const trimmedNeighborhood = neighborhood?.trim();
      
      console.log('🖼️  [useBisetkaBackground] ========== START LOAD ==========');
      console.log('🖼️  [useBisetkaBackground] Inputs:', { 
        city, 
        neighborhood, 
        cacheKey, 
        enabled, 
        forceReload,
        trimmedCity 
      });
      
      if (!enabled || !trimmedCity) {
        console.log('🖼️  [useBisetkaBackground] ❌ SKIPPING - enabled =', enabled, 'city =', trimmedCity);
        if (!cancelled) {
          setBackgroundUrl(null);
          setIsLoading(false);
          setError(null);
        }
        return;
      }
      
      console.log('🖼️  [useBisetkaBackground] ✅ Enabled, city is valid');

      const effectiveCacheKey = cacheKey || `${trimmedNeighborhood || trimmedCity}::${trimmedCity}::${promptTemplate}`;
      
      console.log('🖼️  [useBisetkaBackground] Cache key:', effectiveCacheKey);
      console.log('🖼️  [useBisetkaBackground] Force reload:', forceReload);
      
      // Show loading immediately
      setIsLoading(true);
      setError(null);
      console.log('🖼️  [useBisetkaBackground] ⏳ Loading state set to TRUE');
      
      // Skip cache if forceReload is true
      if (!forceReload) {
        const cachedUrl = backgroundCache.get(effectiveCacheKey);
        console.log('🖼️  [useBisetkaBackground] Checking in-memory cache:', cachedUrl ? 'HIT' : 'MISS');
        if (cachedUrl) {
          console.log('🖼️  [useBisetkaBackground] ✅ Using cached URL for', trimmedCity, ':', cachedUrl);
          if (!cancelled) {
            setBackgroundUrl(cachedUrl);
            setIsLoading(false);
            setError(null);
          }
          return;
        }
      } else {
        console.log('🖼️  [useBisetkaBackground] 🔄 Force reload requested, skipping ALL caches');
      }

      if (!forceReload) {
        console.log('🖼️  [useBisetkaBackground] Checking persisted storage cache...');
        try {
          const persistedBackground = await getPersistedBackground(effectiveCacheKey);
          console.log('🖼️  [useBisetkaBackground] Persisted cache:', persistedBackground ? 'HIT' : 'MISS');
          if (persistedBackground) {
            backgroundCache.set(effectiveCacheKey, persistedBackground.localUri);
            if (!cancelled) {
              setBackgroundUrl(persistedBackground.localUri);
              setIsLoading(false);
              setError(null);
            }
            console.log('🖼️  [useBisetkaBackground] ✅ Using persisted background:', persistedBackground.localUri);
            return;
          }
        } catch (persistedError) {
          console.warn('⚠️ [useBisetkaBackground] Failed to restore local background:', persistedError);
        }
      }

      // Show loading state but DON'T clear the existing background —
      // keep showing the previous image while the new one loads.
      setIsLoading(true);
      setError(null);
      // setBackgroundUrl(null) intentionally removed — stale image > blank screen

      console.log('\uD83D\uDDBC\uFE0F  [useBisetkaBackground] \uD83C\uDF10 No cache found, calling API...');
      
      // Generate in background (non-blocking)
      (async () => {
        try {
          console.log('🖼️  [useBisetkaBackground] 🚀 Calling apiService.getOrGenerateBisetkaBackground for', trimmedCity);
          console.log('🖼️  [useBisetkaBackground] 🚀 Request data:', {
            city: trimmedCity,
            neighborhood: trimmedNeighborhood,
            promptTemplate,
          });

          const result = await apiService.getOrGenerateBisetkaBackground({
            city: trimmedCity,
            neighborhood: trimmedNeighborhood,
            country: country?.trim() || undefined,
            promptTemplate,
          });

          console.log('🖼️  [useBisetkaBackground] ✅ API response received:', result);

          if (!cancelled && result.url) {
            const localUri = await persistBackgroundLocally(effectiveCacheKey, result.url);
            backgroundCache.set(effectiveCacheKey, localUri);
            
            if (!cancelled) {
              setBackgroundUrl(localUri);
              setIsLoading(false);
              setError(null);
              console.log('🖼️  [useBisetkaBackground] Background loaded successfully');
            }
            return;
          }

          if (!cancelled) {
            setBackgroundUrl(null);
            setIsLoading(false);
            setError(null);
          }
        } catch (err: any) {
          console.warn('⚠️ [useBisetkaBackground] Falling back to default background:', err?.message || err);
          if (!cancelled) {
            setBackgroundUrl(null);
            setIsLoading(false);
            setError(null);
          }
        }
      })();
    };

    void loadBackground();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, city, enabled, neighborhood, promptTemplate, forceReload]);

  const imageSource = useMemo(
    () => (backgroundUrl ? { uri: backgroundUrl } : defaultBackground),
    [backgroundUrl],
  );

  return {
    backgroundUrl,
    imageSource,
    hasGeneratedBackground: Boolean(backgroundUrl),
    isLoading,
    error,
  };
};

export default useBisetkaBackground;
