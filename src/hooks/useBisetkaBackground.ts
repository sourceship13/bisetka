import { useEffect, useMemo, useState } from 'react';
import apiService from '../services/api.service';

const defaultBackground = require('../../assets/backgrounds/bisetka.png');
const backgroundCache = new Map<string, string>();

export const DEFAULT_BISETKA_BACKGROUND_PROMPT =
  'a cartoon photo of a bisetka in {locale} and looks really pretty with iconography of {city}';

type UseBisetkaBackgroundOptions = {
  city?: string | null;
  neighborhood?: string | null;
  cacheKey?: string | null;
  promptTemplate?: string;
  enabled?: boolean;
};

const useBisetkaBackground = ({
  city,
  neighborhood,
  cacheKey,
  promptTemplate = DEFAULT_BISETKA_BACKGROUND_PROMPT,
  enabled = true,
}: UseBisetkaBackgroundOptions) => {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBackground = async () => {
      const trimmedCity = city?.trim();
      const trimmedNeighborhood = neighborhood?.trim();
      
      console.log('🖼️  [useBisetkaBackground] Loading background:', { city, neighborhood, cacheKey, enabled, trimmedCity });
      
      if (!enabled || !trimmedCity) {
        console.log('🖼️  [useBisetkaBackground] Skipping: enabled =', enabled, 'city =', trimmedCity);
        if (!cancelled) {
          setBackgroundUrl(null);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      const effectiveCacheKey = cacheKey || `${trimmedNeighborhood || trimmedCity}::${trimmedCity}::${promptTemplate}`;
      const cachedUrl = backgroundCache.get(effectiveCacheKey);
      if (cachedUrl) {
        console.log('🖼️  [useBisetkaBackground] Using cached URL for', trimmedCity);
        if (!cancelled) {
          setBackgroundUrl(cachedUrl);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🖼️  [useBisetkaBackground] Calling API to generate background for', trimmedCity);

        const result = await apiService.getOrGenerateBisetkaBackground({
          city: trimmedCity,
          neighborhood: trimmedNeighborhood,
          promptTemplate,
        });

        console.log('🖼️  [useBisetkaBackground] API response:', result);

        if (!cancelled && result.url) {
          backgroundCache.set(effectiveCacheKey, result.url);
          setBackgroundUrl(result.url);
          setIsLoading(false);
          setError(null);
          console.log('🖼️  [useBisetkaBackground] Background loaded successfully');
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
    };

    void loadBackground();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, city, enabled, neighborhood, promptTemplate]);

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
