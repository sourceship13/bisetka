import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useI18n } from '../../hooks/useI18n';

type TabKey = 'Community' | 'Store' | 'GameHub' | 'Messages' | 'Profile';

type TabDef = {
  key: TabKey;
  label: string;
  labelKey: string;
  icon: string;
  route: string;
  params?: any;
};

const getTabs = (translate: (key: string) => string): TabDef[] => [
  { key: 'Community', label: translate('navigation.community'), labelKey: 'navigation.community', icon: 'home-outline', route: 'Home' },
  { key: 'Store', label: translate('navigation.store'), labelKey: 'navigation.store', icon: 'basket-outline', route: 'PointsShop', params: { initialTab: 'points' } },
  { key: 'GameHub', label: translate('navigation.gameHub'), labelKey: 'navigation.gameHub', icon: 'play', route: 'GameSelection' },
  { key: 'Messages', label: translate('navigation.messages'), labelKey: 'navigation.messages', icon: 'chat-outline', route: 'DMList' },
  { key: 'Profile', label: translate('navigation.profile'), labelKey: 'navigation.profile', icon: 'account-outline', route: 'Profile' },
];

interface Props {
  active?: TabKey;
}

const BottomTabBar: React.FC<Props> = ({ active = 'Community' }) => {
  const { translate } = useI18n();
  const navigation = useNavigation<any>();
  const tabs = useMemo(() => getTabs(translate), [translate]);
  
  // Derive current route name to highlight tab if not explicitly passed
  const currentRoute = useNavigationState(state => {
    if (!state) return undefined;
    const route = state.routes[state.index];
    return route?.name;
  });

  const isActive = (tab: TabDef) => {
    if (active && tab.key === active) return true;
    if (currentRoute === tab.route) return true;
    if (tab.key === 'Community' && currentRoute === 'Home') return true;
    return false;
  };

  const handlePress = (tab: TabDef) => {
    if (tab.route === 'Home') {
      navigation.navigate('Home');
      return;
    }
    navigation.navigate(tab.route as never, tab.params);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.barBg}>
        <SafeAreaView edges={['bottom']} style={styles.safe}>
          <View style={styles.row}>
            {tabs.map(tab => {
              const active = isActive(tab);
              if (tab.key === 'GameHub') {
                return (
                  <View key={tab.key} style={styles.centerSlot}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handlePress(tab)}
                      style={styles.centerBtn}>
                      <View
                        style={[styles.centerCircle, { backgroundColor: '#fbbf24' }]}>
                        <Icon name="play" size={32} color="#fff" />
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.label, styles.centerLabel]}>
                      {tab.label}
                    </Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.7}
                  onPress={() => handlePress(tab)}
                  style={styles.tab}>
                  <Icon
                    name={tab.icon}
                    size={26}
                    color={active ? '#fff' : 'rgba(255,255,255,0.7)'}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: active ? '#fff' : 'rgba(255,255,255,0.7)' },
                    ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  barBg: {
    backgroundColor: 'rgba(8, 6, 24, 0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  safe: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  centerBtn: {
    marginTop: -28,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
  },
  centerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(8, 6, 24, 0.96)',
  },
  centerLabel: {
    color: '#fbbf24',
    fontWeight: '700',
    marginTop: 2,
    ...Platform.select({ android: { marginTop: 0 } }),
  },
});

export default BottomTabBar;
