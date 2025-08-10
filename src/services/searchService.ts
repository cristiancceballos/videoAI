import { supabase } from './supabase';
import { VideoWithMetadata } from './videoService';

// Common abbreviations and their expansions
const TAG_EXPANSIONS: Record<string, string[]> = {
  'cs': ['computer science', 'comp sci'],
  'ml': ['machine learning'],
  'ai': ['artificial intelligence'],
  'dsa': ['data structures', 'algorithms', 'data structures and algorithms'],
  'ds': ['data science', 'data structures'],
  'algo': ['algorithm', 'algorithms'],
  'dev': ['development', 'developer'],
  'frontend': ['front-end', 'front end'],
  'backend': ['back-end', 'back end'],
  'fullstack': ['full-stack', 'full stack'],
  'js': ['javascript'],
  'ts': ['typescript'],
  'py': ['python'],
  'db': ['database', 'databases'],
  'api': ['application programming interface'],
  'ui': ['user interface'],
  'ux': ['user experience'],
  'uiux': ['ui/ux', 'user interface', 'user experience'],
  'oop': ['object oriented programming', 'object-oriented'],
  'fp': ['functional programming'],
  'cp': ['competitive programming'],
  'lc': ['leetcode'],
  'gfg': ['geeksforgeeks', 'geeks for geeks'],
  'swe': ['software engineering', 'software engineer'],
  'se': ['software engineering'],
  'os': ['operating system', 'operating systems'],
  'cn': ['computer networks', 'networking'],
  'dbms': ['database management system'],
  'sql': ['structured query language'],
  'nosql': ['no sql', 'non-relational database'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud platform'],
  'ci': ['continuous integration'],
  'cd': ['continuous deployment', 'continuous delivery'],
  'cicd': ['ci/cd', 'continuous integration', 'continuous deployment'],
  'tdd': ['test driven development'],
  'bdd': ['behavior driven development'],
  'mvc': ['model view controller'],
  'mvvm': ['model view viewmodel'],
  'rest': ['restful', 'representational state transfer'],
  'graphql': ['graph ql'],
  'k8s': ['kubernetes'],
  'docker': ['containerization', 'containers'],
  'vim': ['vi improved'],
  'vscode': ['visual studio code', 'vs code'],
  'git': ['version control'],
  'pr': ['pull request'],
  'mr': ['merge request'],
};

class SearchService {
  /**
   * Expand search query with related terms
   */
  private expandQuery(query: string): string[] {
    const normalizedQuery = query.toLowerCase().trim();
    const terms = [normalizedQuery];
    
    // Check if query is an abbreviation
    if (TAG_EXPANSIONS[normalizedQuery]) {
      terms.push(...TAG_EXPANSIONS[normalizedQuery]);
    }
    
    // Check if query contains any abbreviations as words
    const words = normalizedQuery.split(/\s+/);
    words.forEach(word => {
      if (TAG_EXPANSIONS[word]) {
        TAG_EXPANSIONS[word].forEach(expansion => {
          terms.push(normalizedQuery.replace(word, expansion));
        });
      }
    });
    
    // Also check reverse - if query is an expansion, add abbreviation
    Object.entries(TAG_EXPANSIONS).forEach(([abbr, expansions]) => {
      if (expansions.includes(normalizedQuery)) {
        terms.push(abbr);
      }
    });
    
    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Search videos with expanded query terms
   */
  async searchVideos(userId: string, query: string): Promise<VideoWithMetadata[]> {
    if (!query || query.trim().length === 0) {
      // Return all videos if no search query
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }

    const expandedTerms = this.expandQuery(query);
    
    // Build search conditions for each term
    const searchConditions = expandedTerms.map(term => {
      const escapedTerm = term.replace(/[%_]/g, '\\$&');
      return `
        (
          title.ilike.%${escapedTerm}%,
          tags.cs.{${JSON.stringify(term)}}
        )
      `;
    });

    // First try: Search with Supabase filters
    try {
      // Build complex OR query for all expanded terms
      let queryBuilder = supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ready');

      // Search in title and tags
      const orConditions: string[] = [];
      expandedTerms.forEach(term => {
        orConditions.push(`title.ilike.%${term}%`);
      });

      // Execute search
      const { data: titleMatches, error: titleError } = await queryBuilder
        .or(orConditions.join(','))
        .order('created_at', { ascending: false });

      if (titleError) throw titleError;

      // Also search in tags using RPC function if available
      const { data: tagMatches, error: tagError } = await supabase
        .rpc('search_videos_by_tag', {
          search_query: query,
          user_id_param: userId
        });

      // Combine and deduplicate results
      const allMatches = [...(titleMatches || [])];
      
      if (tagMatches && !tagError) {
        tagMatches.forEach((tagMatch: any) => {
          if (!allMatches.find(m => m.id === tagMatch.id)) {
            allMatches.push(tagMatch);
          }
        });
      }

      return allMatches;
    } catch (error) {
      console.error('Search error:', error);
      
      // Fallback: Simple title search
      const { data, error: fallbackError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .ilike('title', `%${query}%`)
        .order('created_at', { ascending: false });
      
      if (fallbackError) throw fallbackError;
      return data || [];
    }
  }

  /**
   * Get search suggestions based on existing tags
   */
  async getSearchSuggestions(userId: string, query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    try {
      // Get all unique tags from user's videos
      const { data, error } = await supabase
        .from('videos')
        .select('tags')
        .eq('user_id', userId)
        .eq('status', 'ready');

      if (error) throw error;

      // Extract and flatten all tags
      const allTags = new Set<string>();
      data?.forEach(video => {
        if (video.tags && Array.isArray(video.tags)) {
          video.tags.forEach((tag: string) => {
            allTags.add(tag.toLowerCase());
          });
        }
      });

      // Filter tags that match the query
      const normalizedQuery = query.toLowerCase();
      const suggestions = Array.from(allTags)
        .filter(tag => tag.includes(normalizedQuery))
        .sort((a, b) => {
          // Prioritize tags that start with the query
          const aStarts = a.startsWith(normalizedQuery);
          const bStarts = b.startsWith(normalizedQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
        .slice(0, 5); // Return top 5 suggestions

      return suggestions;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }
}

export const searchService = new SearchService();