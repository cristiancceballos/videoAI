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
  postCount?: number;
}

const getTabLabel = (key: ProfileTab, postCount?: number): string => {
  switch (key) {
    case 'posts':
      return postCount !== undefined ? `Posts (${postCount})` : 'Posts';
    case 'search':
      return 'Search';
    case 'select':
      return 'Select';
    default:
      return '';
  }
};

const tabs: { key: ProfileTab }[] = [
  { key: 'posts' },
  { key: 'search' },
  { key: 'select' },
];

export function ProfileTabNavigator({ activeTab, onTabPress, postCount }: ProfileTabNavigatorProps) {
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
              {getTabLabel(tab.key, postCount)}
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
    paddingTop: 3,
    paddingBottom: 1,
    minHeight: 26, // Reduced by 40% for TikTok-style compact appearance
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
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
    fontWeight: '500', // Medium weight for cleaner appearance
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