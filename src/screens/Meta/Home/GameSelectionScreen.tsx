import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../libs/hooks/useAuth';
import bisetkaService, { Bisetka } from '../../../services/bisetka.service';
import BottomTabBar from '../../../components/global/BottomTabBar';

const buildAccountBisetka = (accountBisetka: {
  id: string;
  neighborhood: string;
  city: string;
  country: string;
  active_users: number;
}): Bisetka => ({
  id: accountBisetka.id,
  neighborhood_id: accountBisetka.id,
  neighborhood_name: accountBisetka.neighborhood,
  city: accountBisetka.city,
  country: accountBisetka.country,
  active_users: accountBisetka.active_users,
  created_at: '',
  updated_at: '',
});

type GameConfig = {
  id: string;
  name: string;
  description: string;
  icon: any;
  gradient: [string, string];
  gameType: string;
  players: number;
  entryFee: number;
  comingSoon?: boolean;
};

const GAMES: GameConfig[] = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic Armenian card game',
    icon: require('../../../../assets/game-icons/blot-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'blot',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'baazar-blot',
    name: 'Baazar Blot',
    description: 'Fast-paced Blot variant',
    icon: require('../../../../assets/game-icons/baazar-blot-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'baazar-blot',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Classic jumping game',
    icon: require('../../../../assets/game-icons/checkers-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'checkers',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Strategic board game',
    icon: require('../../../../assets/game-icons/chess-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'chess',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em Poker",
    icon: require('../../../../assets/game-icons/poker-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'poker',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'nardi',
    name: 'Nardi',
    description: 'Backgammon classic',
    icon: require('../../../../assets/game-icons/nardi-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'nardi',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'billiards',
    name: '8-Ball',
    description: 'Pool — sink the 8 to win',
    icon: require('../../../../assets/game-icons/8ball-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'billiards',
    players: 15,
    entryFee: 50,
  },
  {
    id: '9-ball',
    name: '9-Ball',
    description: 'Race to the 9',
    icon: require('../../../../assets/game-icons/9ball-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: '9-ball',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'mrotsi',
    name: 'Mrotsi',
    description: 'Classic dice game',
    icon: require('../../../../assets/game-icons/mrotsi-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'mrotsi',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: '21 — beat the dealer',
    icon: require('../../../../assets/game-icons/blackjack-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'blackjack',
    players: 15,
    entryFee: 50,
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Spin and win',
    icon: require('../../../../assets/game-icons/slots-icon.png'),
    gradient: ['#7a6cf5', '#5b4ae0'],
    gameType: 'slots',
    players: 15,
    entryFee: 50,
  },
];

const GameSelectionScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [bisetka, setBisetka] = useState<Bisetka | null>(
    user?.bisetka ? buildAccountBisetka(user.bisetka) : null,
  );

  useEffect(() => {
    let isMounted = true;

    const loadBisetka = async () => {
      if (user?.bisetka) {
        setBisetka(buildAccountBisetka(user.bisetka));
        return;
      }

      const currentBisetka = await bisetkaService.getMyBisetka();
      const ipResult = currentBisetka
        ? null
        : await bisetkaService.getByIpBisetka();

      if (!isMounted) return;
      setBisetka(currentBisetka || ipResult?.bisetka || null);
    };

    void loadBisetka();
    return () => {
      isMounted = false;
    };
  }, [user?.bisetka]);

  const handleGamePress = (game: GameConfig) => {
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient as unknown as string[],
    });
  };

  const renderGameCard = (game: GameConfig) => {
    return (
      <TouchableOpacity
        key={game.id}
        activeOpacity={0.9}
        disabled={game.comingSoon}
        onPress={() => handleGamePress(game)}
        style={[styles.gameCardWrapper, game.comingSoon && styles.cardDisabled]}>
        <LinearGradient
          colors={game.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gameCard}>
          <View style={styles.thumbWrap}>
            <Image
              source={game.icon}
              style={styles.thumbImg}
              resizeMode="cover"
            />
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.gameName} numberOfLines={1}>
              {game.name}
            </Text>
            <Text style={styles.gameDescription} numberOfLines={1}>
              {game.description}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="account-group" size={16} color="#fff" />
                <Text style={styles.metaText}>{game.players}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.coinIcon}>🪙</Text>
                <Text style={styles.metaText}>{game.entryFee}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleGamePress(game)}
                style={styles.playBtnWrap}>
                <View style={styles.playBtn}>
                  <Text style={styles.playBtnText}>PLAY NOW</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {game.comingSoon && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const cityLabel = bisetka
    ? `${bisetka.city}${bisetka.country ? `, ${bisetka.country}` : ''}`
    : user?.bisetka
    ? `${user.bisetka.city}, ${user.bisetka.country}`
    : 'Locating...';

  const activeUsers = bisetka?.active_users || 0;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Top header card */}
          <View style={styles.topHeader}>
            <Text style={styles.topHeaderTitle}>Game Hub</Text>
            <View style={styles.topHeaderRight}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PointsShop')}
                activeOpacity={0.85}>
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsCoin}>🪙</Text>
                  <Text style={styles.pointsAmount}>
                    {Math.floor(user?.balance || 0).toLocaleString()}
                  </Text>
                  <View style={styles.pointsPlus}>
                    <Icon name="plus" size={11} color="#fff" />
                    <Text style={styles.pointsPlusText}>Get Points</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('GlobalView', { userId: user?.id })
                }
                style={styles.globeBtn}
                activeOpacity={0.85}>
                <Icon name="earth" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location row */}
          <View style={styles.locationRow}>
            <View style={styles.locationLeft}>
              <View style={styles.locationTitleRow}>
                <Icon name="map-marker" size={18} color="#fff" />
                <Text style={styles.locationTitle}>{cityLabel}</Text>
              </View>
              <Text style={styles.locationSub}>
                {activeUsers} players  •  2 kings
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Travel')}
              activeOpacity={0.7}>
              <Text style={styles.changeLocation}>Change Location</Text>
            </TouchableOpacity>
          </View>

          {/* Game list */}
          <View style={styles.gamesList}>{GAMES.map(renderGameCard)}</View>
        </ScrollView>
      </SafeAreaView>
      <BottomTabBar active="GameHub" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100828',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
    borderRadius: 22,
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 14, 60, 0.95)',
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    gap: 6,
  },
  pointsCoin: {
    fontSize: 16,
  },
  pointsAmount: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  pointsPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
    gap: 2,
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 14,
  },
  locationLeft: {
    flex: 1,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  locationSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 22,
  },
  changeLocation: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  gamesList: {
    paddingHorizontal: 14,
    gap: 14,
  },
  gameCardWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
  },
  thumbWrap: {
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    margin:10
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  gameName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  gameDescription: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  coinIcon: {
    fontSize: 14,
  },
  playBtnWrap: {
    marginLeft: 'auto',
    marginRight: 12,
    borderRadius: 999,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 10,
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.1,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
});

export default GameSelectionScreen;
