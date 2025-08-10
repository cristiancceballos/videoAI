import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { getInterFontConfigForInputs } from '../utils/fontUtils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceDelay?: number;
}

export function SearchBar({ 
  onSearch, 
  placeholder = "Search videos, tags, topics...",
  debounceDelay = 300 
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const animatedWidth = React.useRef(new Animated.Value(0)).current;
  const debounceTimer = React.useRef<NodeJS.Timeout>();

  // Animate search bar focus
  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      onSearch(text);
    }, debounceDelay);
  }, [onSearch, debounceDelay]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    onSearch('');
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, [onSearch]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const borderColor = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['#333', '#007AFF'],
  });

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.searchContainer,
          { borderColor }
        ]}
      >
        <Search 
          size={20} 
          color={isFocused ? '#007AFF' : '#8e8e93'} 
          style={styles.searchIcon}
        />
        
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never" // We use custom clear button
        />
        
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={clearSearch}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color="#8e8e93" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    ...getInterFontConfigForInputs('200'),
    color: '#fff',
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});