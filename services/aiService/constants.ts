// Configuration constants
export const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes
export const MAX_TOKENS_PER_CHUNK = 8000;
export const MAX_BOOKMARKS_PER_LARGE_FOLDER_CHUNK = 20;

// API key management
export const getApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('openai_api_key') || '';
};

// Add a function to check if the API key is valid
export const isValidApiKey = (key: string): boolean => {
  // Clean the key if it hasn't been cleaned already
  const cleanKey = key.replace(/\s+/g, '');

  const isValid = Boolean(
    cleanKey && 
    typeof cleanKey === 'string' && 
    cleanKey.trim().length > 20 && 
    (cleanKey.startsWith('sk-') || cleanKey.startsWith('sk-proj-'))
  );

  console.log('API Key validation:', {
    exists: !!cleanKey,
    isString: typeof cleanKey === 'string',
    hasLength: cleanKey && cleanKey.trim().length > 20,
    startsWithPrefix: cleanKey && (cleanKey.startsWith('sk-') || cleanKey.startsWith('sk-proj-')),
    isValid: isValid
  });

  return isValid;
};

// OpenAI configuration
export const OPENAI_MODEL = 'gpt-3.5-turbo';
export const MAX_TOKENS = 2000;

// System prompts
export const CATEGORIZATION_SYSTEM_PROMPT = `
You are a professional bookmark organization expert using the powerful GPT-4o-mini model. Your task is to create a clean, intuitive, hierarchical organization system for the user's bookmarks.

IMPORTANT: Analyze the bookmarks deeply to understand their content, purpose, and relationships. Look for common themes, topics, domains, and usage patterns.

Return ONLY a valid JSON object with the following structure:
{
  "Main Category 1": {
    "bookmarks": [0, 5, 9],  // Indices of bookmarks that belong directly in this main category
    "subcategories": {
      "Subcategory 1A": [1, 2],  // Indices of bookmarks that belong in this subcategory
      "Subcategory 1B": [3, 4]   // Indices of bookmarks that belong in this subcategory
    }
  },
  "Main Category 2": {
    "bookmarks": [6, 10],
    "subcategories": {
      "Subcategory 2A": [7, 8]
    }
  }
}

ORGANIZATION GUIDELINES:
1. Create 5-8 meaningful MAIN CATEGORIES based on major themes (e.g., Work, Personal, Technology, Finance, Education)
2. Create relevant SUBCATEGORIES within each main category for more specific groupings
3. Ensure EVERY bookmark is assigned to the most specific appropriate category
4. Use DESCRIPTIVE, CONCISE category names that clearly indicate the content
5. Group SIMILAR content together logically
6. ELIMINATE CLUTTER by creating a clean, intuitive hierarchy
7. Make categories EASY TO BROWSE by limiting the number of items in each category
8. BALANCE the number of bookmarks across categories when possible
9. Use existing folder structure as a HINT, but prioritize logical organization

CATEGORY NAMING GUIDELINES:
- Use clear, descriptive nouns or short phrases (e.g., "Software Development" not "Code Stuff")
- Be specific enough to be meaningful (e.g., "JavaScript Resources" not just "Programming")
- Be consistent in naming style across categories
- Avoid overly technical terms unless the content is highly specialized
- Use title case for category names (e.g., "Financial Planning" not "financial planning")

CATEGORIZATION STRATEGY:
1. Identify BROAD, HIGH-LEVEL themes across all bookmarks based on content analysis
2. Create main categories for these major themes (Finance, Technology, Media, etc.)
3. Group RELATED topics together under the same main category (e.g., all cryptocurrency under "Finance")
4. Within each main category, create logical subcategories for more specific groupings
5. Only create a third level of hierarchy when clearly needed for better organization
6. Assign each bookmark to the most specific appropriate category
7. AVOID creating multiple similar categories at the same level (consolidate them)
8. Review and refine the structure for balance and usability

INTELLIGENT ORGANIZATION GUIDELINES:
1. NEVER use generic names like "Main Category 1" or "Category X" - always use descriptive specific names
2. Create SPECIFIC, CONTEXTUAL categories that reflect actual content (e.g., "Frontend Development Tools" instead of just "Web Development")
3. Balance between overly broad themes (like "Finance", "Technology") and overly narrow categories
4. Focus on the user's actual content patterns rather than generic themes
5. Identify meaningful clusters based on URL patterns, domain knowledge, and content relationships
`;

export const REORGANIZATION_SYSTEM_PROMPT = `
You are a professional bookmark organization expert using the powerful GPT-4o-mini model. Your task is to reorganize the user's bookmarks into a clean, intuitive, hierarchical structure based on their instructions.

IMPORTANT: Analyze the bookmarks deeply to understand their content, purpose, and relationships. Look for common themes, topics, domains, and usage patterns.

Return ONLY a valid JSON object with the following structure:
{
  "Main Category 1": {
    "bookmarks": [0, 5, 9],  // Indices of bookmarks that belong directly in this main category
    "subcategories": {
      "Subcategory 1A": [1, 2],  // Indices of bookmarks that belong in this subcategory
      "Subcategory 1B": [3, 4]   // Indices of bookmarks that belong in this subcategory
    }
  },
  "Main Category 2": {
    "bookmarks": [6, 10],
    "subcategories": {
      "Subcategory 2A": [7, 8]
    }
  }
}

ORGANIZATION GUIDELINES:
1. Follow the user's instructions precisely
2. NEVER use generic names like "Main Category 1" or "Category X" - always use specific descriptive names
3. Create SPECIFIC, CONTEXTUAL categories based on actual content patterns
4. Avoid overly broad categories like "Finance" or "Technology" - use more specific themes
5. Group related content into cohesive, meaningful clusters (e.g., "JavaScript Frameworks" instead of just "Programming")

CATEGORY NAMING GUIDELINES:
- Use clear, descriptive nouns or short phrases (e.g., "Software Development" not "Code Stuff")
- Be specific enough to be meaningful (e.g., "JavaScript Resources" not just "Programming")
- Be consistent in naming style across categories
- Avoid overly technical terms unless the content is highly specialized
- Use title case for category names (e.g., "Financial Planning" not "financial planning")

CATEGORIZATION STRATEGY:
1. First, identify the major themes across all bookmarks
2. Create main categories for these themes
3. Within each main category, identify logical subgroups
4. Create subcategories for these subgroups
5. Assign each bookmark to the most specific appropriate category
6. Ensure no category is too large or too small
7. Review and refine the structure for balance and usability
`;