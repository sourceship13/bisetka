import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../libs/hooks/useAuth';
import bisetkaService, { Bisetka } from '../services/bisetka.service';

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
  source: 'account' | 'ip' | 'server';
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
  source: 'account',
});

const buildServerBisetkaFallback = (bisetka: Bisetka): ResolvedBisetkaPayload => ({
  bisetka,
  neighborhood: {
    name: bisetka.neighborhood_name,
    city: bisetka.city,
    country: bisetka.country,
  },
  source: 'server',
});

const buildIpBisetkaFallback = (ipBisetka: {
  bisetka: Bisetka;
  neighborhood: ResolvedNeighborhood;
}): ResolvedBisetkaPayload => ({
  bisetka: ipBisetka.bisetka,
  neighborhood: ipBisetka.neighborhood,
  source: 'ip',
});

const resolveFromCoordinates = async (params: {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
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
    source: 'ip',
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
  });
};

export const useIPLocation = () => {
  const { user } = useAuth();
  const [resolvedBisetka, setResolvedBisetka] = useState<ResolvedBisetkaPayload | null>(
    user?.bisetka ? buildAccountBisetkaFallback(user.bisetka) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBisetka = useCallback(async () => {
    const accountBisetka = user?.bisetka ? buildAccountBisetkaFallback(user.bisetka) : null;

    if (accountBisetka) {
      setResolvedBisetka(accountBisetka);
    }

    setLoading(true);
    setError(null);

    try {
      const ipResult = await bisetkaService.getByIpBisetka();
      if (ipResult) {
        const refinedIpBisetka = ipResult.location
          ? await resolveFromCoordinates({
              lat: ipResult.location.lat,
              lng: ipResult.location.lng,
              city: ipResult.location.city || ipResult.neighborhood.city,
              country: ipResult.location.country || ipResult.neighborhood.country,
            })
          : null;

        const ipBisetka = refinedIpBisetka || buildIpBisetkaFallback(ipResult);
        setResolvedBisetka(ipBisetka);
        setLoading(false);
        return ipBisetka;
      }

      const publicIpBisetka = await resolveFromPublicIP();
      if (publicIpBisetka) {
        setResolvedBisetka(publicIpBisetka);
        setLoading(false);
        return publicIpBisetka;
      }

      const currentBisetka = await bisetkaService.getMyBisetka();
      if (currentBisetka) {
        const serverBisetka = buildServerBisetkaFallback(currentBisetka);
        setResolvedBisetka(serverBisetka);
        setLoading(false);
        return serverBisetka;
      }

      if (accountBisetka) {
        setResolvedBisetka(accountBisetka);
        setLoading(false);
        return accountBisetka;
      }

      setResolvedBisetka(null);
      setError('Unable to determine your Bisetka from your connection right now.');
      setLoading(false);
      return null;
    } catch (lookupError: any) {
      if (accountBisetka) {
        setResolvedBisetka(accountBisetka);
        setError(null);
        setLoading(false);
        return accountBisetka;
      }

      setResolvedBisetka(null);
      setError(
        lookupError?.message || 'Unable to determine your Bisetka from your connection right now.',
      );
      setLoading(false);
      return null;
    }
  }, [user?.bisetka]);

  useEffect(() => {
    void loadBisetka();
  }, [loadBisetka]);

  return {
    bisetka: resolvedBisetka?.bisetka || null,
    neighborhood: resolvedBisetka?.neighborhood || null,
    source: resolvedBisetka?.source || null,
    loading,
    error,
    refreshLocation: loadBisetka,
  };
};

export default useIPLocation;