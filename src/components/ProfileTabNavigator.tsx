import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

export type ProfileTab = 'posts' | 'search' | 'select';

interface ProfileTabNavigatorProps {
  activeTab: ProfileTab;
  onTabPress: (tab: ProfileTab) => void;
}

const tabs: { key: ProfileTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'search', label: 'Search' },
  { key: 'select', label: 'Select' },
];

export function ProfileTabNavigator({ activeTab, onTabPress }: ProfileTabNavigatorProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 52, // 10-15% taller than typical tab bar
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44, // Accessibility touch target
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '400',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700', // Bold text for active tab
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#007AFF', // TikTok-style accent color
    borderRadius: 1,
  },
});