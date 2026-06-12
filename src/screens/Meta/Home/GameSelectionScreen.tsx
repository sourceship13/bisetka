import React, { useMemo } from 'react';
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
import BottomTabBar from '../../../components/global/BottomTabBar';
import { useI18n } from '../../../hooks/useI18n';
import { GAMES_CONFIG, resolveAllGames } from '../../../utils/gamesConfig';

type GameConfig = ReturnType<typeof resolveAllGames>[number];

const GameSelectionScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { translate } = useI18n();
  
  // Resolve games with current language
  const games = useMemo(() => resolveAllGames(translate), [translate]);

  const handleGamePress = (game: any) => {
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

          {/* Game list */}
          <View style={styles.gamesList}>{games.map(renderGameCard)}</View>
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
