// Configuration constants
export const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes
export const MAX_TOKENS_PER_CHUNK = 8000;
export const MAX_BOOKMARKS_PER_LARGE_FOLDER_CHUNK = 20;

// API key management
export const getApiKey = (): string => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("openai_api_key") || "";
};

// Add a function to check if the API key is valid
export const isValidApiKey = (key: string): boolean => {
  // Clean the key if it hasn't been cleaned already
  const cleanKey = key.replace(/\s+/g, "");

  const isValid = Boolean(
    cleanKey &&
      typeof cleanKey === "string" &&
      cleanKey.trim().length > 20 &&
      (cleanKey.startsWith("sk-") || cleanKey.startsWith("sk-proj-")),
  );

  console.log("API Key validation:", {
    exists: !!cleanKey,
    isString: typeof cleanKey === "string",
    hasLength: cleanKey && cleanKey.trim().length > 20,
    startsWithPrefix:
      cleanKey &&
      (cleanKey.startsWith("sk-") || cleanKey.startsWith("sk-proj-")),
    isValid: isValid,
  });

  return isValid;
};

// OpenAI configuration
export const OPENAI_MODEL = "gpt-4o-mini";
export const MAX_TOKENS = 2000;

// System prompts
export const CATEGORIZATION_SYSTEM_PROMPT = `
You are an expert in organizing bookmarks. Your objective is to create a logical and coherent structure for the user's chrome browser bookmarks.

STRATEGIC GUIDELINES:
1. Analyze the bookmarks in-depth to understand their themes and context.
2. Use examples below and analogies to find common themes and logical groupings.
3. Instead of generic names, use contextual examples for category creation. E.g., group "Python Guides" under "Programming Languages" rather than just "Books".
4. Balance specificity and breadth - ensure categories are neither too broad nor too specific, reflecting how related bookmarks genuinely connect.
5. Leverage multiple levels only when truly beneficial, keeping the hierarchy intuitive and user-friendly.

CATEGORY EXAMPLES:
- AI-related bookmarks like RAG, GitHub, prompt engineering, etc., in relevant folders under a Parent "AI" folder in the All Bookmarks folder.
- Cryptocurrency-related bookmarks would go into a "Cryptocurrency" folder in the All Bookmarks folder with related sub-folders.
- EY-related bookmarks would be in an "EY" folder in the All Bookmarks folder.
- Project Management and Product Management could be consolidated into a "Project & Product Management" in the All Bookmarks folder.

Focus on creating a structure that mirrors the user's workflow, preferences, and the nature of the bookmarks. Provide a JSON structure:
{
  "Category Name": {
    "bookmarks": [indices of bookmarks],
    "subcategories": {
      "Subcategory Name": [indices of bookmarks]
    }
  }
}
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
3. In sub-folders create SPECIFIC, CONTEXTUAL categories based on actual content patterns, but broader in the top-level folder
4. Avoid overly broad categories like "Finance" or "Technology" - use more specific themes
5. Group related content into cohesive, meaningful clusters (e.g., "JavaScript Frameworks" instead of just "Programming")

CATEGORY NAMING GUIDELINES:
- Use clear, descriptive nouns or short phrases (e.g., "Software Development" not "Code Stuff")
- Be specific enough to be meaningful (e.g., "JavaScript Resources" not just "Programming")
- Be consistent in naming style across categories
- Use title case for category names (e.g., "Financial Planning" not "financial planning")

CATEGORIZATION STRATEGY:
1. First, identify the major themes across all bookmarks
2. Create main categories for these themes
3. Within each main category, identify logical subgroups
4. Create subcategories for these subgroups
5. Assign each bookmark to the most appropriate topic, theme, subgroup, or category
6. Review and refine the structure for balance and usability
`;
