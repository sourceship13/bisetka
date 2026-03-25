import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../libs/hooks/useAuth';
import bisetkaService, { Bisetka } from '../services/bisetka.service';
import bisetkaStorageService from '../services/bisetkaStorage.service';
import locationService, { UserLocation } from '../services/location.service';

type PublicIPLocation = {
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  success?: boolean;
};

type ResolvedNeighborhood = {
  name: string;
  city: string;
  country: string;
};

type ResolvedBisetkaPayload = {
  bisetka: Bisetka;
  neighborhood: ResolvedNeighborhood;
  location?: UserLocation | null;
  source: 'account' | 'gps' | 'ip' | 'server';
};

const buildAccountBisetkaFallback = (accountBisetka: {
  id: string;
  neighborhood: string;
  city: string;
  country: string;
  active_users: number;
}): ResolvedBisetkaPayload => ({
  bisetka: {
    id: accountBisetka.id,
    neighborhood_id: accountBisetka.id,
    neighborhood_name: accountBisetka.neighborhood,
    city: accountBisetka.city,
    country: accountBisetka.country,
    active_users: accountBisetka.active_users,
    created_at: '',
    updated_at: '',
  },
  neighborhood: {
    name: accountBisetka.neighborhood,
    city: accountBisetka.city,
    country: accountBisetka.country,
  },
  location: null,
  source: 'account',
});

const buildServerBisetkaFallback = (bisetka: Bisetka): ResolvedBisetkaPayload => ({
  bisetka,
  neighborhood: {
    name: bisetka.neighborhood_name,
    city: bisetka.city,
    country: bisetka.country,
  },
  location: null,
  source: 'server',
});

const buildIpBisetkaFallback = (ipBisetka: {
  bisetka: Bisetka;
  neighborhood: ResolvedNeighborhood;
}): ResolvedBisetkaPayload => ({
  bisetka: ipBisetka.bisetka,
  neighborhood: ipBisetka.neighborhood,
  location: null,
  source: 'ip',
});

const buildGpsBisetkaFallback = (
  bisetka: Bisetka,
  neighborhood: ResolvedNeighborhood,
  location: UserLocation,
): ResolvedBisetkaPayload => ({
  bisetka,
  neighborhood,
  location,
  source: 'gps',
});

const resolveFromCoordinates = async (params: {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  source: 'gps' | 'ip';
  location?: UserLocation;
}): Promise<ResolvedBisetkaPayload | null> => {
  const resolved = await bisetkaService.resolveFromCoordinates(params.lat, params.lng, {
    city: params.city,
    country: params.country,
  });

  if (!resolved) {
    return null;
  }

  return {
    bisetka: resolved.bisetka,
    neighborhood: {
      name: resolved.neighborhood.name,
      city: resolved.neighborhood.city,
      country: resolved.neighborhood.country,
    },
    location: params.location || null,
    source: params.source,
  };
};

const getPublicIPLocation = async (): Promise<PublicIPLocation | null> => {
  try {
    const response = await fetch('https://ipwho.is/');
    const data = (await response.json()) as PublicIPLocation;

    if (data.success === false) {
      return null;
    }

    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Public IP geolocation fallback failed:', error);
    return null;
  }
};

const resolveFromPublicIP = async (): Promise<ResolvedBisetkaPayload | null> => {
  const publicLocation = await getPublicIPLocation();
  if (!publicLocation) {
    return null;
  }

  return resolveFromCoordinates({
    lat: publicLocation.latitude!,
    lng: publicLocation.longitude!,
    city: publicLocation.city,
    country: publicLocation.country,
    source: 'ip',
  });
};

export const useBisetkaLocation = () => {
  const { user } = useAuth();
  const accountBisetkaId = user?.bisetka?.id || null;
  const accountNeighborhood = user?.bisetka?.neighborhood || null;
  const accountCity = user?.bisetka?.city || null;
  const accountCountry = user?.bisetka?.country || null;
  const accountActiveUsers = user?.bisetka?.active_users || 0;
  const [resolvedBisetka, setResolvedBisetka] = useState<ResolvedBisetkaPayload | null>(
    user?.bisetka ? buildAccountBisetkaFallback(user.bisetka) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const resolvedBisetkaRef = useRef<ResolvedBisetkaPayload | null>(resolvedBisetka);

  useEffect(() => {
    resolvedBisetkaRef.current = resolvedBisetka;
  }, [resolvedBisetka]);

  const loadBisetka = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const accountBisetka =
      accountBisetkaId && accountNeighborhood && accountCity && accountCountry
        ? buildAccountBisetkaFallback({
            id: accountBisetkaId,
            neighborhood: accountNeighborhood,
            city: accountCity,
            country: accountCountry,
            active_users: accountActiveUsers,
          })
        : null;

    const applyResolvedBisetka = (payload: ResolvedBisetkaPayload | null) => {
      if (requestId !== requestIdRef.current) {
        return false;
      }

      setResolvedBisetka(payload);
      return true;
    };

    const finishLoading = (nextError: string | null = null) => {
      if (requestId !== requestIdRef.current) {
        return false;
      }

      setError(nextError);
      setLoading(false);
      return true;
    };

    if (accountBisetka) {
      applyResolvedBisetka(accountBisetka);
      finishLoading(null);
      return accountBisetka;
    }

    setLoading(!resolvedBisetkaRef.current && !accountBisetka);
    setError(null);

    try {
      const currentBisetka = await bisetkaService.getMyBisetka();
      if (currentBisetka) {
        const serverBisetka = buildServerBisetkaFallback(currentBisetka);
        applyResolvedBisetka(serverBisetka);
        finishLoading(null);
        return serverBisetka;
      }

      const deviceLocation = await locationService.getLocationForBisetka();
      if (deviceLocation) {
        const gpsNeighborhoodPromise = bisetkaService.findNearestNeighborhood(
          deviceLocation.latitude,
          deviceLocation.longitude,
        );
        const gpsBisetkaPromise = bisetkaService.autoConnect(
          deviceLocation.latitude,
          deviceLocation.longitude,
        );

        const [gpsNeighborhood, gpsBisetka] = await Promise.all([
          gpsNeighborhoodPromise,
          gpsBisetkaPromise,
        ]);

        const refinedGpsBisetka = await resolveFromCoordinates({
          lat: deviceLocation.latitude,
          lng: deviceLocation.longitude,
          city: gpsNeighborhood?.city,
          country: gpsNeighborhood?.country,
          source: 'gps',
          location: deviceLocation,
        });

        const gpsResolved = gpsBisetka
          ? buildGpsBisetkaFallback(
              gpsBisetka,
              {
                name: gpsNeighborhood?.name || gpsBisetka.neighborhood_name,
                city: gpsNeighborhood?.city || gpsBisetka.city,
                country: gpsNeighborhood?.country || gpsBisetka.country,
              },
              deviceLocation,
            )
          : refinedGpsBisetka;

        if (gpsResolved) {
          applyResolvedBisetka(gpsResolved);
          await bisetkaStorageService.storeBisetka({
            id: gpsResolved.bisetka.id,
            neighborhood: gpsResolved.bisetka.neighborhood_name,
            city: gpsResolved.bisetka.city,
            country: gpsResolved.bisetka.country,
            active_users: gpsResolved.bisetka.active_users,
            source: 'gps',
          });
          finishLoading(null);
          return gpsResolved;
        }
      }

      const ipResult = await bisetkaService.getByIpBisetka();
      if (ipResult) {
        const refinedIpBisetka = ipResult.location
          ? await resolveFromCoordinates({
              lat: ipResult.location.lat,
              lng: ipResult.location.lng,
              city: ipResult.location.city || ipResult.neighborhood.city,
              country: ipResult.location.country || ipResult.neighborhood.country,
              source: 'ip',
            })
          : null;

        const ipBisetka = refinedIpBisetka || buildIpBisetkaFallback(ipResult);
        applyResolvedBisetka(ipBisetka);
        finishLoading(null);
        return ipBisetka;
      }

      const publicIpBisetka = await resolveFromPublicIP();
      if (publicIpBisetka) {
        applyResolvedBisetka(publicIpBisetka);
        finishLoading(null);
        return publicIpBisetka;
      }

      if (accountBisetka) {
        applyResolvedBisetka(accountBisetka);
        finishLoading(null);
        return accountBisetka;
      }

      if (!resolvedBisetkaRef.current) {
        applyResolvedBisetka(null);
      }
      finishLoading(
        resolvedBisetkaRef.current
          ? null
          : 'Unable to determine your Bisetka from your location right now.',
      );
      return null;
    } catch (lookupError: any) {
      if (accountBisetka) {
        applyResolvedBisetka(accountBisetka);
        finishLoading(null);
        return accountBisetka;
      }

      if (!resolvedBisetkaRef.current) {
        applyResolvedBisetka(null);
      }
      finishLoading(
        resolvedBisetkaRef.current
          ? null
          : lookupError?.message || 'Unable to determine your Bisetka from your location right now.',
      );
      return null;
    }
  }, [accountActiveUsers, accountBisetkaId, accountCity, accountCountry, accountNeighborhood]);

  useEffect(() => {
    console.log('🔄 [useBisetkaLocation] loadBisetka triggered');
    void loadBisetka();
  }, [loadBisetka]);

  return {
    bisetka: resolvedBisetka?.bisetka || null,
    neighborhood: resolvedBisetka?.neighborhood || null,
    source: resolvedBisetka?.source || null,
    location: resolvedBisetka?.location || null,
    loading,
    error,
    refreshLocation: loadBisetka,
  };
};

export default useBisetkaLocation;