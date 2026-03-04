import { useDebounce } from '@/hooks/use-debounce';
import ExploreGrid from '@/src/components/explore/ExploreGrid';
import { ExploreSearchBar } from '@/src/components/explore/ExploreSearchBar';
import { ProfileSuggestion, ProfileSuggestions } from '@/src/components/explore/ProfileSuggestions';
import { useGetExploreQuery } from '@/src/features/post/explore.hooks';
import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

export default function SearchScreen() {
  const { theme } = useTheme()
  const styles = createStyles(theme)

  const [searchText, setSearchText] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debouncedSearch = useDebounce(searchText, 500);

  const {
    gridItems,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = useGetExploreQuery();

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchText('');
  }, []);

  const handleProfileSelect = useCallback((profile: ProfileSuggestion) => {
    // Handle profile selection - navigate to profile screen
    console.log('Selected profile:', profile);
    handleSearchBlur();
    // router.push(`/profile/${profile.id}`);
  }, [handleSearchBlur]);

  const handlePostPress = useCallback((postId: number) => {
    // Navigate to post detail screen
    console.log('Post pressed:', postId);
    router.push({
      pathname: '/post/[postId]',
      params: {
        postId: postId.toString(),
      },
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  return (
    <View style={styles.container}>
      {/* <SafeAreaView style={styles.container} edges={['top']}> */}
      <ExploreSearchBar
        value={searchText}
        onChangeText={setSearchText}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        onClear={handleSearchClear}
        isFocused={isSearchFocused}
      />

      <View style={styles.content}>
        {isSearchFocused && (
          <ProfileSuggestions
            query={debouncedSearch}
            suggestions={[]} // Pass real data when API is ready
            isLoading={false} // Pass real loading state when API is ready
            onSelect={handleProfileSelect}
          />
        )}

        <ExploreGrid
          gridItems={gridItems}
          isLoading={isLoading}
          isRefreshing={isRefetching}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage ?? false}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          onPostPress={handlePostPress}
        />
      </View>
      {/* // </SafeAreaView> */}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
});