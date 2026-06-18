// Data Management Functions

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
        return null;
    }
}

// Data Storage
let categories = {};
let bookmarks = [];

// Import review state
let importReviewBookmarks = [];
let importReviewSource = 'file_import';

// Local Storage Functions
function ensureBookmarkIds() {
    bookmarks.forEach(b => { if (!b.id) b.id = crypto.randomUUID(); });
}

function saveBookmarksToStorage(source = 'manual') {
    try {
        ensureBookmarkIds();
        localStorage.setItem('pinpanda_bookmarks', JSON.stringify(bookmarks));
        localStorage.setItem('pinpanda_categories', JSON.stringify(categories));
        console.log('Bookmarks saved to storage');
        syncToBackend(source);
    } catch (error) {
        console.error('Error saving bookmarks to storage:', error);
    }
}

async function syncToBackend(source = 'manual') {
    try {
        const backendUrl = getBackendUrl();
        const payload = {
            bookmarks: bookmarks.map(b => ({
                id: b.id,
                title: b.title,
                url: b.url,
                description: b.description || '',
                category: b.category || 'Uncategorized',
                dateAdded: b.dateAdded instanceof Date ? b.dateAdded.toISOString() : (b.dateAdded || null),
                favicon: b.favicon || null,
                folder: b.folder || null
            })),
            source
        };
        const res = await fetch(`${backendUrl}/api/bookmarks/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const delta = await res.json();
            console.log(`Backend sync — added: ${delta.added}, updated: ${delta.updated}, total: ${delta.total}`);
        }
    } catch (err) {
        console.debug('Backend sync skipped:', err.message);
    }
}

async function loadBookmarksFromStorage() {
    // 1. Load localStorage immediately for instant display
    try {
        const savedBookmarks = localStorage.getItem('pinpanda_bookmarks');
        const savedCategories = localStorage.getItem('pinpanda_categories');

        if (savedBookmarks) {
            bookmarks = JSON.parse(savedBookmarks);
            bookmarks.forEach(bookmark => {
                if (bookmark.dateAdded && typeof bookmark.dateAdded === 'string') {
                    bookmark.dateAdded = new Date(bookmark.dateAdded);
                }
            });
            console.log(`Loaded ${bookmarks.length} bookmarks from localStorage`);
        }
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }
    } catch (error) {
        console.error('Error loading bookmarks from localStorage:', error);
    }

    // 2. Hydrate from backend (source of truth) — non-blocking fallback
    try {
        const backendUrl = getBackendUrl();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${backendUrl}/api/bookmarks`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            const serverBookmarks = await res.json();
            if (serverBookmarks.length > 0) {
                bookmarks = serverBookmarks.map(b => ({
                    ...b,
                    dateAdded: b.dateAdded ? new Date(b.dateAdded) : new Date()
                }));
                categories = generateCategoriesFromBookmarks(bookmarks);
                localStorage.setItem('pinpanda_bookmarks', JSON.stringify(bookmarks));
                localStorage.setItem('pinpanda_categories', JSON.stringify(categories));
                console.log(`Hydrated ${bookmarks.length} bookmarks from backend`);
            }
        }
    } catch (err) {
        console.info('Backend unavailable, using localStorage data:', err.message);
    }

    return bookmarks.length > 0;
}

function clearBookmarkStorage() {
    localStorage.removeItem('pinpanda_bookmarks');
    localStorage.removeItem('pinpanda_categories');
    bookmarks = [];
    categories = {};
    renderCategoryTree();
    updateBookmarkDisplay();
    console.log('Bookmark storage cleared');
}

// Backend URL utilities
function getBackendUrl() {
    // In Replit, ports are exposed on the same domain with :port
    if (window.location.hostname.includes('.replit.dev') || window.location.hostname.includes('.repl.co')) {
        // Replit environment - use same domain with port 8000
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    
    // Fallback for local development
    return `${window.location.protocol}//${window.location.hostname}:8000`;
}

// Tracks whether the backend has a .env-configured API key, so the UI can enable
// AI features without requiring the user to paste a key into Settings.
const backendKeyStatus = { hasOpenAI: false, hasGemini: false };

function backendHasAnyKey() {
    return backendKeyStatus.hasOpenAI || backendKeyStatus.hasGemini;
}

async function testBackendConnection() {
    const backendUrl = getBackendUrl();
    try {
        console.log('Testing backend connection to:', backendUrl);
        const response = await fetch(`${backendUrl}/api/health`, {
            method: 'GET',
            timeout: 5000
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connection successful:', data);
            backendKeyStatus.hasOpenAI = !!data.has_openai_key;
            backendKeyStatus.hasGemini = !!data.has_gemini_key;
            updateReorganizeButton();
            return { connected: true, url: backendUrl, status: data };
        } else {
            console.error('❌ Backend connection failed:', response.status);
            return { connected: false, url: backendUrl, error: `HTTP ${response.status}` };
        }
    } catch (error) {
        console.error('❌ Backend connection error:', error);
        return { connected: false, url: backendUrl, error: error.message };
    }
}

async function testLLMConnection(apiKey, model, settings) {
    if (!apiKey || !apiKey.trim()) {
        return { connected: false, error: 'No API key provided' };
    }

    try {
        console.log('Testing LLM connection with model:', model);

        const modelId = getModelName(model);
        const isGemini = isGeminiModel(modelId);
        const { baseUrl } = getAPIConfig(modelId, settings || {});
        const useResponsesAPI = !isGemini && modelId.startsWith('gpt-5');
        const endpoint = useResponsesAPI ? `${baseUrl}/responses` : `${baseUrl}/chat/completions`;

        const requestBody = useResponsesAPI ? {
            model: modelId,
            input: 'Respond with exactly: "Connection test successful"',
            text: { verbosity: 'low' },
            reasoning: { effort: 'minimal' }
        } : {
            model: modelId,
            messages: [
                { role: 'system', content: 'You are a test assistant.' },
                { role: 'user', content: 'Respond with exactly: "Connection test successful"' }
            ],
            max_tokens: 10,
            temperature: 0
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ LLM connection successful:', data);

            const responseContent = useResponsesAPI
                ? data.text?.content || 'Success'
                : data.choices[0]?.message?.content || 'Success';

            return {
                connected: true,
                model: modelId,
                response: responseContent
            };
        } else {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            console.error('❌ LLM connection failed:', response.status, errorData);
            return {
                connected: false,
                error: `API Error: ${errorData.error?.message || response.statusText}`,
                status: response.status
            };
        }
    } catch (error) {
        console.error('❌ LLM connection error:', error);
        return { connected: false, error: error.message };
    }
}

// AI Settings Storage
function saveAISettings() {
    const settings = {
        aiEnabled: document.getElementById('ai-enabled')?.checked || false,
        reorganizeModel: document.getElementById('reorganize-model')?.value || 'gpt-5.4-mini',
        chatModel: document.getElementById('chat-model')?.value || 'gpt-5.4-nano',
        apiKey: document.getElementById('openai-api-key')?.value || '',
        geminiApiKey: document.getElementById('gemini-api-key')?.value || '',
        categorizationDepth: document.getElementById('categorization-depth')?.value || 'balanced'
    };

    try {
        localStorage.setItem('pinpanda_ai_settings', JSON.stringify(settings));
        console.log('AI settings saved');
    } catch (error) {
        console.error('Error saving AI settings:', error);
    }
}

function loadAISettings() {
    try {
        const savedSettings = localStorage.getItem('pinpanda_ai_settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);

            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                const aiEnabled = document.getElementById('ai-enabled');
                const reorganizeModel = document.getElementById('reorganize-model');
                const chatModel = document.getElementById('chat-model');
                const apiKey = document.getElementById('openai-api-key');
                const geminiApiKey = document.getElementById('gemini-api-key');
                const categorizationDepth = document.getElementById('categorization-depth');

                if (aiEnabled) aiEnabled.checked = settings.aiEnabled;
                if (reorganizeModel) reorganizeModel.value = settings.reorganizeModel || settings.aiModel || 'gpt-5.4-mini';
                if (chatModel) chatModel.value = settings.chatModel || 'gpt-5.4-nano';
                if (apiKey) apiKey.value = settings.apiKey;
                if (geminiApiKey) geminiApiKey.value = settings.geminiApiKey || '';
                if (categorizationDepth) categorizationDepth.value = settings.categorizationDepth;

                console.log('AI settings loaded');
            }, 100);

            return settings;
        }
    } catch (error) {
        console.error('Error loading AI settings:', error);
    }

    return null;
}

// AI Integration
async function categorizeBookmarksWithAI(bookmarks) {
    const settings = loadAISettings();
    const hasKey = settings?.apiKey || settings?.geminiApiKey;

    if (!settings || !settings.aiEnabled || !hasKey) {
        console.log('AI categorization disabled or API key missing');
        return generateCategoriesFromBookmarks(bookmarks);
    }
    
    try {
        console.log('Starting AI categorization for', bookmarks.length, 'bookmarks');
        
        // Process bookmarks in batches to avoid API limits
        const batchSize = 20;
        const batches = [];
        
        for (let i = 0; i < bookmarks.length; i += batchSize) {
            batches.push(bookmarks.slice(i, i + batchSize));
        }
        
        const categorizedBookmarks = [];
        
        for (const batch of batches) {
            const result = await processBatchWithAI(batch, settings);
            categorizedBookmarks.push(...result);
        }
        
        // Update bookmark categories
        categorizedBookmarks.forEach((aiBookmark, index) => {
            if (bookmarks[index]) {
                bookmarks[index].category = aiBookmark.category;
            }
        });
        
        // Generate category structure from AI-categorized bookmarks
        return generateCategoriesFromBookmarks(bookmarks);
        
    } catch (error) {
        console.error('AI categorization failed, falling back to default:', error);
        return generateCategoriesFromBookmarks(bookmarks);
    }
}

async function processBatchWithAI(bookmarks, settings) {
    const prompt = createCategorizationPrompt(bookmarks, settings.categorizationDepth);
    const modelId = getModelName(settings.reorganizeModel || settings.aiModel);
    const { baseUrl, apiKey } = getAPIConfig(modelId, settings);

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelId,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at organizing bookmarks. Analyze each bookmark and assign it to an appropriate category. Return only a JSON array with the same number of items, each containing a "category" field.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            ...(modelId.startsWith('gpt-5') ? {} : { max_tokens: 2000 })
        })
    });

    if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
        return JSON.parse(content);
    } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        throw new Error('Invalid AI response format');
    }
}

function createCategorizationPrompt(bookmarks, depth) {
    const depthInstructions = {
        simple: 'Use broad, general categories (5-8 categories max). Examples: Work, Entertainment, Shopping, News, Social Media',
        balanced: 'Use specific but not overly detailed categories (10-15 categories). Create logical groupings.',
        detailed: 'Create detailed subcategories for precise organization (20+ categories). Use hierarchical structure with "/" separators.'
    };
    
    const instruction = depthInstructions[depth] || depthInstructions.balanced;
    
    const bookmarkList = bookmarks.map((bookmark, index) => ({
        index,
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description || ''
    }));
    
    return `${instruction}

Analyze these bookmarks and assign appropriate categories:

${JSON.stringify(bookmarkList, null, 2)}

Return a JSON array with the same number of items (${bookmarks.length}), each containing only a "category" field. For detailed categorization, use "/" to separate hierarchy levels (e.g., "Development/JavaScript/React").`;
}

function getModelName(selectedModel) {
    const modelMap = {
        'gpt-5.5': 'gpt-5.5',
        'gpt-5.5-pro': 'gpt-5.5-pro',
        'gpt-5.4-mini': 'gpt-5.4-mini',
        'gpt-5.4-nano': 'gpt-5.4-nano',
        'gpt-5': 'gpt-5',
        'gpt-5-mini': 'gpt-5-mini',
        'gpt-5-nano': 'gpt-5-nano',
        'o3': 'o3',
        'o3-mini': 'o3-mini',
        'gpt-4o': 'gpt-4o',
        'gpt-4.1': 'gpt-4.1',
        'gpt-4o-mini': 'gpt-4o-mini',
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        'gpt-3.5': 'gpt-3.5-turbo',
        'gpt-4': 'gpt-4o',
        'gemini-3.5-flash': 'gemini-3.5-flash',
        'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite',
        'gemini-2.5-pro': 'gemini-2.5-pro',
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    };
    return modelMap[selectedModel] || selectedModel || 'gpt-5.4-mini';
}

function isGeminiModel(model) {
    return typeof model === 'string' && model.startsWith('gemini-');
}

function getAPIConfig(model, settings) {
    if (isGeminiModel(model)) {
        return {
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: settings.geminiApiKey || ''
        };
    }
    return {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: settings.apiKey || ''
    };
}

// State Management
let currentCategory = '';
let currentView = 'grid';
let searchQuery = '';
let isAISearch = false;
let currentPage = 1;
let pageSize = 25;
let sortField = 'dateAdded';
let sortDirection = 'desc';
let currentBookmarks = [];

// Selection State
let selectedBookmarks = new Set(); // Track selected bookmark URLs
let selectionMode = false; // Whether we're in selection mode

// Category sorting state
let categorySortField = 'name'; // name, count
let categorySortDirection = 'asc';

// DOM Elements
const categoryTree = document.getElementById('category-tree');
const bookmarksContainer = document.getElementById('bookmarks-container');
const searchInput = document.getElementById('search-input');
const searchToggle = document.getElementById('search-toggle');
const aiPanel = document.getElementById('ai-panel');
const contextTitle = document.getElementById('context-title');
const bookmarkCount = document.getElementById('bookmark-count');
const filterControls = document.getElementById('filter-controls');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    loadAISettings();
    setupEventListeners();
    updateSortDropdown();

    loadBookmarksFromStorage().then(() => {
        renderCategoryTree();
        updateBookmarkDisplay();
        updateReorganizeButton();
    });

    const aiStatus = document.getElementById('ai-connection-status');
    if (aiStatus) {
        aiStatus.addEventListener('click', () => {
            updateAIConnectionStatus('testing');
            runAIStatusCheck();
        });
    }

    updateAIConnectionStatus('testing');
    runAIStatusCheck();
});

// Runs backend connectivity + per-provider key probes in parallel and
// pushes the aggregated result into the header indicator.
async function runAIStatusCheck() {
    const [backendResult, providers] = await Promise.all([
        testBackendConnection(),
        collectProviderStatus()
    ]);
    updateAIConnectionStatus('ready', { backend: backendResult, providers });
}

function updateReorganizeButton() {
    const reorganizeBtn = document.getElementById('reorganize-btn');
    if (!reorganizeBtn) return;
    const aiSettings = loadAISettings();
    const hasUiKey = !!(aiSettings?.apiKey || aiSettings?.geminiApiKey);
    const hasBackendKey = backendHasAnyKey();
    const aiUsable = hasBackendKey || (aiSettings?.aiEnabled && hasUiKey);

    if (bookmarks.length === 0) {
        reorganizeBtn.disabled = true;
        reorganizeBtn.title = 'No bookmarks to reorganize';
    } else if (!aiUsable) {
        reorganizeBtn.disabled = true;
        reorganizeBtn.title = 'Please configure AI settings first';
    } else {
        reorganizeBtn.disabled = false;
        reorganizeBtn.title = hasBackendKey
            ? 'Reorganize bookmarks with AI (using server .env key)'
            : 'Reorganize bookmarks with AI';
    }
}

function updateAIStatusIndicator(status) {
    const indicator = document.getElementById('ai-status-indicator');
    if (!indicator) return;
    
    // Remove all status classes
    indicator.classList.remove('connected', 'disconnected', 'testing');
    
    switch (status) {
        case 'connected':
            indicator.textContent = '✅';
            indicator.classList.add('connected');
            indicator.title = 'AI service connected';
            break;
        case 'disconnected':
            indicator.textContent = '❌';
            indicator.classList.add('disconnected');
            indicator.title = 'AI service not available';
            break;
        case 'testing':
            indicator.textContent = '⏳';
            indicator.classList.add('testing');
            indicator.title = 'Testing AI service connection...';
            break;
        default:
            indicator.textContent = '⚡';
            indicator.title = 'AI service status unknown';
    }
}

function updateAIConnectionStatus(status, results = null) {
    const statusElement = document.getElementById('ai-connection-status');
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');

    if (!statusElement || !indicator || !text) return;

    statusElement.classList.remove('connected', 'disconnected', 'testing');

    if (status === 'testing') {
        statusElement.classList.add('testing');
        indicator.textContent = '⏳';
        text.textContent = 'Testing AI...';
        statusElement.title = 'Testing AI connections...';
        return;
    }

    if (status !== 'ready' || !results) {
        indicator.textContent = '⚡';
        text.textContent = 'AI Status';
        statusElement.title = 'AI status unknown';
        return;
    }

    const backendOk = !!results.backend?.connected;
    const providers = results.providers || [];
    const tested = providers.filter(p => p.configured);
    const failed = tested.filter(p => !p.ok);
    const passed = tested.filter(p => p.ok);

    const lines = [`Backend: ${backendOk ? '✅ Connected' : '❌ ' + (results.backend?.error || 'Disconnected')}`];
    for (const p of providers) {
        if (!p.configured) {
            lines.push(`${p.provider} (${p.source}): — not configured`);
        } else if (p.ok) {
            lines.push(`${p.provider} (${p.source}): ✅ ${p.model || 'OK'}`);
        } else {
            lines.push(`${p.provider} (${p.source}): ❌ ${p.error || 'failed'}`);
        }
    }
    statusElement.title = lines.join('\n');

    if (!backendOk) {
        statusElement.classList.add('disconnected');
        indicator.textContent = '❌';
        text.textContent = 'AI Offline';
        return;
    }

    if (tested.length === 0) {
        statusElement.classList.add('disconnected');
        indicator.textContent = '🔑';
        text.textContent = 'Need API Key';
        return;
    }

    if (failed.length > 0) {
        statusElement.classList.add('disconnected');
        indicator.textContent = '⚠️';
        text.textContent = `AI: ${failed.length} key${failed.length > 1 ? 's' : ''} failing`;
        return;
    }

    statusElement.classList.add('connected');
    indicator.textContent = '🤖';
    const sources = [...new Set(passed.map(p => p.source))];
    text.textContent = 'AI Ready';
    if (sources.length) {
        text.textContent += sources.includes('env') && sources.includes('ui')
            ? ' (env + UI)'
            : sources[0] === 'env' ? ' (.env)' : ' (UI key)';
    }
}

async function testAIConnection() {
    const settings = loadAISettings();
    const hasKey = settings?.apiKey || settings?.geminiApiKey;
    if (!settings || !settings.aiEnabled || !hasKey) {
        return { connected: false, error: 'No API key configured' };
    }

    const model = settings.chatModel || settings.reorganizeModel || settings.aiModel || 'gpt-5.4-mini';
    const modelId = getModelName(model);
    const { apiKey } = getAPIConfig(modelId, settings);
    return await testLLMConnection(apiKey, model, settings);
}

// Fetches the backend's live test of its .env-configured provider keys.
async function fetchBackendKeyTests() {
    try {
        const resp = await fetch(`${getBackendUrl()}/api/test-keys`);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        console.warn('Backend key test failed:', e);
        return null;
    }
}

// Aggregates env + UI key probes into a unified per-provider list.
// "AI Ready" requires every configured provider's test to have passed.
async function collectProviderStatus() {
    const [backendTests, settings] = await Promise.all([
        fetchBackendKeyTests(),
        Promise.resolve(loadAISettings())
    ]);

    const providers = [];

    const env = backendTests?.providers || {};
    providers.push({
        provider: 'OpenAI',
        source: 'env',
        configured: !!env.openai?.configured,
        ok: !!env.openai?.ok,
        model: env.openai?.model || null,
        error: env.openai?.error || null
    });
    providers.push({
        provider: 'Gemini',
        source: 'env',
        configured: !!env.gemini?.configured,
        ok: !!env.gemini?.ok,
        model: env.gemini?.model || null,
        error: env.gemini?.error || null
    });

    const uiKey = settings?.aiEnabled && (settings?.apiKey || settings?.geminiApiKey);
    if (uiKey) {
        const probe = await testAIConnection();
        const usingGemini = !settings.apiKey && !!settings.geminiApiKey;
        providers.push({
            provider: usingGemini ? 'Gemini' : 'OpenAI',
            source: 'ui',
            configured: true,
            ok: !!probe.connected,
            model: probe.model || null,
            error: probe.error || null
        });
    }

    backendKeyStatus.hasOpenAI = providers.some(p => p.provider === 'OpenAI' && p.source === 'env' && p.configured);
    backendKeyStatus.hasGemini = providers.some(p => p.provider === 'Gemini' && p.source === 'env' && p.configured);
    updateReorganizeButton();

    return providers;
}

async function testConnectionAfterKeyChange() {
    // Persist current field values immediately so a refresh keeps the key
    // even if the user closes the modal without clicking "Save Settings".
    saveAISettings();

    const settings = JSON.parse(localStorage.getItem('pinpanda_ai_settings') || '{}');
    const hasKey = settings.apiKey || settings.geminiApiKey;
    if (!hasKey) return;

    const statusElement = document.getElementById('llm-connection-status');
    const resultElement = document.getElementById('connection-result');

    if (!statusElement || !resultElement) return;

    statusElement.style.display = 'block';
    statusElement.className = 'llm-connection-status testing';
    resultElement.textContent = '⏳ Testing connection...';

    try {
        const model = settings.chatModel || settings.reorganizeModel || settings.aiModel || 'gpt-5.4-mini';
        const modelId = getModelName(model);
        const { apiKey } = getAPIConfig(modelId, settings);
        const result = await testLLMConnection(apiKey, model, settings);
        
        if (result.connected) {
            statusElement.className = 'llm-connection-status success';
            resultElement.textContent = `✅ Connected to ${result.model} successfully`;
        } else {
            statusElement.className = 'llm-connection-status error';
            resultElement.textContent = `❌ ${result.error}`;
        }
        
        // Update main AI status
        const backendResult = await testBackendConnection();
        updateAIConnectionStatus('ready', { backend: backendResult, llm: result });
        
    } catch (error) {
        statusElement.className = 'llm-connection-status error';
        resultElement.textContent = `❌ Connection failed: ${error.message}`;
    }
}

// Event Listeners
function setupEventListeners() {
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                updateBookmarkDisplay();
            }
        });
    }
    
    if (searchToggle) {
        searchToggle.addEventListener('click', toggleSearchMode);
    }
    
    // AI input handling
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendAIMessage();
            }
        });
    }
}

// Category Sorting
function sortCategoryEntries(entries) {
    return entries.sort((a, b) => {
        const [aName, aData] = a;
        const [bName, bData] = b;
        
        let aVal, bVal;
        
        switch (categorySortField) {
            case 'name':
                aVal = aName.toLowerCase();
                bVal = bName.toLowerCase();
                break;
            case 'count':
                aVal = getTotalBookmarks(aData);
                bVal = getTotalBookmarks(bData);
                break;
            default:
                return 0;
        }
        
        if (aVal < bVal) return categorySortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return categorySortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function handleCategorySort(field) {
    if (categorySortField === field) {
        categorySortDirection = categorySortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        categorySortField = field;
        categorySortDirection = 'asc';
    }
    
    renderCategoryTree();
}

// Render Category Tree
function renderCategoryTree() {
    categoryTree.innerHTML = '';
    
    // Add category sorting controls
    const sortControls = document.createElement('div');
    sortControls.className = 'category-sort-controls';
    sortControls.innerHTML = `
        <div class="sort-label">Sort by:</div>
        <button class="sort-btn ${categorySortField === 'name' ? 'active' : ''}" onclick="handleCategorySort('name')">
            Name ${categorySortField === 'name' ? (categorySortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button class="sort-btn ${categorySortField === 'count' ? 'active' : ''}" onclick="handleCategorySort('count')">
            Count ${categorySortField === 'count' ? (categorySortDirection === 'asc' ? '↑' : '↓') : ''}
        </button>
    `;
    categoryTree.appendChild(sortControls);
    
    // Add "All Bookmarks" option
    const allItem = createCategoryItem('All Bookmarks', bookmarks.length, '', true);
    categoryTree.appendChild(allItem);
    
    // Render categories (sorted)
    const sortedEntries = sortCategoryEntries(Object.entries(categories));
    sortedEntries.forEach(([name, data]) => {
        const item = createCategoryElement(name, data, 0);
        categoryTree.appendChild(item);
    });
}

function createCategoryElement(name, data, level) {
    const container = document.createElement('div');
    
    const bookmarkTotal = getTotalBookmarks(data);
    const hasChildren = data.children && Object.keys(data.children).length > 0;
    
    const item = createCategoryItem(name, bookmarkTotal, name, false, hasChildren);
    container.appendChild(item);
    
    if (hasChildren) {
        const childContainer = document.createElement('div');
        childContainer.className = 'category-children';
        childContainer.style.display = 'none';
        
        // Sort children too
        const sortedChildren = sortCategoryEntries(Object.entries(data.children));
        sortedChildren.forEach(([childName, childData]) => {
            const childPath = `${name} / ${childName}`;
            const childElement = createCategoryElement(childName, childData, level + 1);
            childContainer.appendChild(childElement);
        });
        
        container.appendChild(childContainer);
    }
    
    return container;
}

function createCategoryItem(name, count, path, isActive = false, hasChildren = false) {
    const item = document.createElement('div');
    item.className = `category-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`;
    item.onclick = () => selectCategory(path, item);
    
    // Add drop event listeners
    item.addEventListener('dragover', (e) => handleCategoryDragOver(e, path));
    item.addEventListener('drop', (e) => handleCategoryDrop(e, path));
    item.addEventListener('dragleave', handleCategoryDragLeave);
    
    const content = document.createElement('span');
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.gap = '8px';
    content.style.width = '100%';
    
    if (hasChildren) {
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = '▶';
        expandIcon.onclick = (e) => {
            e.stopPropagation();
            toggleCategory(item);
        };
        content.appendChild(expandIcon);
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.flex = '1';
    content.appendChild(nameSpan);
    
    const countSpan = document.createElement('span');
    countSpan.className = 'bookmark-count';
    countSpan.textContent = count.toString();
    content.appendChild(countSpan);
    
    item.appendChild(content);
    return item;
}

function getTotalBookmarks(data) {
    let total = data.bookmarks || 0;
    if (data.children) {
        Object.values(data.children).forEach(child => {
            total += getTotalBookmarks(child);
        });
    }
    return total;
}

function toggleCategory(item) {
    const childContainer = item.parentElement.querySelector('.category-children');
    const expandIcon = item.querySelector('.expand-icon');
    
    if (childContainer) {
        const isExpanded = childContainer.style.display !== 'none';
        childContainer.style.display = isExpanded ? 'none' : 'block';
        expandIcon.textContent = isExpanded ? '▶' : '▼';
        item.classList.toggle('expanded', !isExpanded);
    }
}

function selectCategory(path, item) {
    // Remove active class from all items
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    
    // Add active class to selected item
    item.classList.add('active');
    
    currentCategory = path;
    
    // Update context
    if (path === '') {
        contextTitle.textContent = 'All Bookmarks';
        renderBookmarks(bookmarks);
    } else {
        contextTitle.textContent = path;
        const filteredBookmarks = bookmarks.filter(bookmark => 
            bookmark.category.startsWith(path)
        );
        renderBookmarks(filteredBookmarks);
    }
    
    // Clear search
    searchInput.value = '';
    searchQuery = '';
    filterControls.style.display = 'none';
}

// Pagination and Sorting
function sortBookmarks(bookmarks) {
    return [...bookmarks].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortField) {
            case 'title':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
            case 'category':
                aVal = a.category.toLowerCase();
                bVal = b.category.toLowerCase();
                break;
            case 'url':
                aVal = a.url.toLowerCase();
                bVal = b.url.toLowerCase();
                break;
            case 'domain':
                try {
                    aVal = new URL(a.url).hostname.toLowerCase();
                    bVal = new URL(b.url).hostname.toLowerCase();
                } catch {
                    aVal = a.url.toLowerCase();
                    bVal = b.url.toLowerCase();
                }
                break;
            case 'dateAdded':
                aVal = a.dateAdded;
                bVal = b.dateAdded;
                break;
            default:
                return 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function paginateBookmarks(bookmarks) {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return bookmarks.slice(startIndex, endIndex);
}

function getTotalPages(totalBookmarks) {
    return Math.ceil(totalBookmarks / pageSize);
}

// Render Bookmarks
function renderBookmarks(bookmarks) {
    currentBookmarks = bookmarks;
    const sortedBookmarks = sortBookmarks(bookmarks);
    const totalPages = getTotalPages(sortedBookmarks.length);
    
    // Reset to page 1 if current page is beyond available pages
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    const paginatedBookmarks = paginateBookmarks(sortedBookmarks);
    
    bookmarkCount.textContent = `(${bookmarks.length} bookmarks)`;
    
    bookmarksContainer.className = `bookmarks-container`;
    bookmarksContainer.innerHTML = '';
    
    if (bookmarks.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.textAlign = 'center';
        emptyState.style.padding = '40px';
        emptyState.style.color = '#6c757d';
        emptyState.innerHTML = '<h3>No bookmarks found</h3><p>Try adjusting your search or filters.</p>';
        bookmarksContainer.appendChild(emptyState);
        return;
    }
    
    if (currentView === 'list') {
        renderBookmarkTable(paginatedBookmarks);
    } else {
        renderBookmarkGrid(paginatedBookmarks);
    }
    
    renderPagination(sortedBookmarks.length, totalPages);
}

function renderBookmarkGrid(bookmarks) {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'bookmarks-grid';
    
    bookmarks.forEach(bookmark => {
        const item = createBookmarkGridItem(bookmark);
        gridContainer.appendChild(item);
    });
    
    bookmarksContainer.appendChild(gridContainer);
}

function renderBookmarkTable(bookmarks) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'bookmarks-list';
    
    const table = document.createElement('table');
    table.className = 'bookmarks-table';
    
    // Create header
    const header = document.createElement('thead');
    header.className = 'bookmarks-table-header';
    header.innerHTML = `
        <tr>
            <th class="sortable" onclick="handleSort('title')">
                NAME
                <span class="sort-icon ${sortField === 'title' ? 'active' : ''}">
                    ${sortField === 'title' && sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            </th>
            <th class="sortable" onclick="handleSort('domain')">
                DOMAIN
                <span class="sort-icon ${sortField === 'domain' ? 'active' : ''}">
                    ${sortField === 'domain' && sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            </th>
            <th class="sortable" onclick="handleSort('category')">
                CATEGORY
                <span class="sort-icon ${sortField === 'category' ? 'active' : ''}">
                    ${sortField === 'category' && sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            </th>
            <th class="sortable" onclick="handleSort('dateAdded')">
                ADDED
                <span class="sort-icon ${sortField === 'dateAdded' ? 'active' : ''}">
                    ${sortField === 'dateAdded' && sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            </th>
            <th style="width: 100px;"></th>
        </tr>
    `;
    
    const tbody = document.createElement('tbody');
    
    bookmarks.forEach(bookmark => {
        const row = createBookmarkTableRow(bookmark);
        tbody.appendChild(row);
    });
    
    table.appendChild(header);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    bookmarksContainer.appendChild(tableContainer);
}

function createBookmarkGridItem(bookmark) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.draggable = true;
    item.onclick = () => window.open(bookmark.url, '_blank');
    
    // Add drag event listeners
    item.addEventListener('dragstart', (e) => handleBookmarkDragStart(e, bookmark));
    item.addEventListener('dragend', handleBookmarkDragEnd);
    
    item.innerHTML = `
        <input type="checkbox" class="selection-checkbox" onclick="handleBookmarkSelection(event, '${escapeHtml(bookmark.url)}')" />
        <div class="drag-handle">⋮⋮</div>
        <button class="action-btn bookmark-menu-btn bookmark-menu-btn--grid" title="More options">⋯</button>
        <a href="${escapeHtml(bookmark.url)}" class="bookmark-title" target="_blank" onclick="event.stopPropagation()" draggable="false">
            ${escapeHtml(bookmark.title)}
        </a>
        <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
        <div class="bookmark-description">${escapeHtml(bookmark.description || '')}</div>
        <div class="bookmark-category">${escapeHtml(bookmark.category)}</div>
    `;

    item.querySelector('.bookmark-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showBookmarkMenu(e, bookmark.url);
    });

    return item;
}

function createBookmarkTableRow(bookmark) {
    const row = document.createElement('tr');
    row.className = 'bookmarks-table-row';
    row.draggable = true;
    
    // Add drag event listeners
    row.addEventListener('dragstart', (e) => handleBookmarkDragStart(e, bookmark));
    row.addEventListener('dragend', handleBookmarkDragEnd);
    
    const favicon = bookmark.favicon ? 
        `<img src="${bookmark.favicon}" alt="" class="bookmark-favicon" onerror="this.style.display='none'" />` :
        `<div class="bookmark-favicon">🔗</div>`;
    
    const categoryParts = bookmark.category.split(' / ');
    const categoryTags = categoryParts.map(part => 
        `<span class="bookmark-category-tag">${part}</span>`
    ).join('');
    
    const dateFormatted = bookmark.dateAdded.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    // Extract domain for display
    let domain;
    try {
        domain = new URL(bookmark.url).hostname;
    } catch {
        domain = bookmark.url;
    }
    
    row.innerHTML = `
        <td class="bookmarks-table-cell">
            <div class="bookmark-name-cell">
                <input type="checkbox" class="selection-checkbox" onclick="handleBookmarkSelection(event, '${bookmark.url}')" />
                ${favicon}
                <div class="bookmark-info">
                    <a href="${bookmark.url}" class="bookmark-title" target="_blank">
                        ${bookmark.title}
                    </a>
                    <div class="bookmark-url">${bookmark.url}</div>
                </div>
            </div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-domain">${domain}</div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-category-cell">
                ${categoryTags}
            </div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-date">${dateFormatted}</div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-actions">
                <button class="action-btn" onclick="window.open('${escapeHtml(bookmark.url)}', '_blank')" title="Open">
                    ↗
                </button>
                <button class="action-btn bookmark-menu-btn" title="More options">
                    ⋯
                </button>
            </div>
        </td>
    `;

    row.querySelector('.bookmark-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showBookmarkMenu(e, bookmark.url);
    });

    return row;
}

function renderPagination(totalBookmarks, totalPages) {
    if (totalBookmarks <= pageSize) return;
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container';
    
    const startItem = ((currentPage - 1) * pageSize) + 1;
    const endItem = Math.min(currentPage * pageSize, totalBookmarks);
    
    paginationContainer.innerHTML = `
        <div class="pagination-info">
            Showing ${startItem}-${endItem} of ${totalBookmarks} bookmarks
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                ← Previous
            </button>
            ${generatePageNumbers(totalPages)}
            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next →
            </button>
            <div class="page-size-selector">
                <span>Show:</span>
                <select onchange="changePageSize(this.value)">
                    <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
            </div>
        </div>
    `;
    
    bookmarksContainer.appendChild(paginationContainer);
}

function generatePageNumbers(totalPages) {
    let pages = '';
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }
    
    return pages;
}

function goToPage(page) {
    const totalPages = getTotalPages(currentBookmarks.length);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderBookmarks(currentBookmarks);
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize);
    currentPage = 1;
    renderBookmarks(currentBookmarks);
}

function updatePagination() {
    const totalPages = getTotalPages(currentBookmarks.length);
    
    // Reset to page 1 if current page is beyond available pages
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = 1;
    }
    
    // Remove existing pagination
    const existingPagination = document.querySelector('.pagination-container');
    if (existingPagination) {
        existingPagination.remove();
    }
    
    // Re-render pagination
    if (currentBookmarks.length > 0) {
        renderPagination(currentBookmarks.length, totalPages);
    }
}

function handleSort(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }
    
    // Update dropdown to reflect current sort
    updateSortDropdown();
    renderBookmarks(currentBookmarks);
}

function handleBookmarkSort(value) {
    const [field, direction] = value.split('-');
    sortField = field;
    sortDirection = direction;
    renderBookmarks(currentBookmarks);
}

function updateSortDropdown() {
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.value = `${sortField}-${sortDirection}`;
    }
}

function showBookmarkMenu(event, bookmarkUrl) {
    event.stopPropagation();
    closeBookmarkMenu();

    const menu = document.createElement('div');
    menu.id = 'bookmark-context-menu';
    menu.className = 'bookmark-context-menu';

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'context-menu-item context-menu-danger';
    deleteBtn.textContent = '🗑 Delete';
    deleteBtn.addEventListener('click', () => deleteBookmark(bookmarkUrl));
    menu.appendChild(deleteBtn);

    // Separator + label
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    menu.appendChild(sep);
    const label = document.createElement('div');
    label.className = 'context-menu-label';
    label.textContent = 'Move to category';
    menu.appendChild(label);

    // Category list
    const catsContainer = document.createElement('div');
    catsContainer.className = 'context-menu-categories';
    const cats = Object.keys(categories).sort();
    if (cats.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'context-menu-empty';
        empty.textContent = 'No categories yet';
        catsContainer.appendChild(empty);
    } else {
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item context-menu-category';
            btn.textContent = cat;
            btn.addEventListener('click', () => moveBookmarkToCategory(bookmarkUrl, cat));
            catsContainer.appendChild(btn);
        });
    }
    menu.appendChild(catsContainer);
    document.body.appendChild(menu);

    // Position below the trigger button
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    let left = rect.right - menuWidth + window.scrollX;
    if (left < 8) left = 8;
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${left}px`;
    menu.style.minWidth = `${menuWidth}px`;

    setTimeout(() => document.addEventListener('click', closeBookmarkMenu, { once: true }), 0);
}

function closeBookmarkMenu() {
    const menu = document.getElementById('bookmark-context-menu');
    if (menu) menu.remove();
}

function deleteBookmark(url) {
    closeBookmarkMenu();
    const idx = bookmarks.findIndex(b => b.url === url);
    if (idx === -1) return;
    const bookmark = bookmarks[idx];

    if (bookmark.id) {
        const backendUrl = getBackendUrl();
        fetch(`${backendUrl}/api/bookmarks/${bookmark.id}`, { method: 'DELETE' })
            .catch(err => console.debug('Backend delete skipped:', err.message));
    }

    bookmarks.splice(idx, 1);
    categories = generateCategoriesFromBookmarks(bookmarks);
    saveBookmarksToStorage('manual');
    renderCategoryTree();
    updateBookmarkDisplay();
    showToast('Bookmark deleted.');
}

function moveBookmarkToCategory(url, newCategory) {
    closeBookmarkMenu();
    const bookmark = bookmarks.find(b => b.url === url);
    if (!bookmark) return;
    bookmark.category = newCategory;
    categories = generateCategoriesFromBookmarks(bookmarks);
    saveBookmarksToStorage('manual');
    renderCategoryTree();
    updateBookmarkDisplay();
    showToast(`Moved to "${newCategory}".`);
}

function bulkDeleteBookmarks() {
    const urls = Array.from(selectedBookmarks);
    if (urls.length === 0) return;
    if (!confirm(`Delete ${urls.length} bookmark${urls.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;

    const backendUrl = getBackendUrl();
    const urlSet = new Set(urls);
    const toDelete = bookmarks.filter(b => urlSet.has(b.url));

    toDelete.forEach(b => {
        if (b.id) {
            fetch(`${backendUrl}/api/bookmarks/${b.id}`, { method: 'DELETE' })
                .catch(err => console.debug('Backend delete skipped:', err.message));
        }
    });

    bookmarks = bookmarks.filter(b => !urlSet.has(b.url));
    categories = generateCategoriesFromBookmarks(bookmarks);
    saveBookmarksToStorage('manual');
    renderCategoryTree();
    updateBookmarkDisplay();
    exitSelectionMode();
    showToast(`Deleted ${toDelete.length} bookmark${toDelete.length !== 1 ? 's' : ''}.`);
}

function bulkMoveToCategory() {
    if (selectedBookmarks.size === 0) return;
    closeBookmarkMenu();

    const anchor = document.querySelector('#bulk-actions-bar .bulk-action-btn');
    if (!anchor) return;

    const menu = document.createElement('div');
    menu.id = 'bookmark-context-menu';
    menu.className = 'bookmark-context-menu';

    const label = document.createElement('div');
    label.className = 'context-menu-label';
    label.textContent = `Move ${selectedBookmarks.size} bookmark${selectedBookmarks.size !== 1 ? 's' : ''} to`;
    menu.appendChild(label);

    const catsContainer = document.createElement('div');
    catsContainer.className = 'context-menu-categories';
    const cats = Object.keys(categories).sort();
    if (cats.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'context-menu-empty';
        empty.textContent = 'No categories yet';
        catsContainer.appendChild(empty);
    } else {
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item context-menu-category';
            btn.textContent = cat;
            btn.addEventListener('click', () => applyBulkMove(cat));
            catsContainer.appendChild(btn);
        });
    }
    menu.appendChild(catsContainer);
    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    const menuWidth = 240;
    let left = rect.left + window.scrollX;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    menu.style.top = `${rect.top + window.scrollY - menu.offsetHeight - 8}px`;
    menu.style.left = `${left}px`;
    menu.style.minWidth = `${menuWidth}px`;

    const requestedTop = rect.top + window.scrollY - menu.getBoundingClientRect().height - 8;
    menu.style.top = `${requestedTop > 8 ? requestedTop : rect.bottom + window.scrollY + 4}px`;

    setTimeout(() => document.addEventListener('click', closeBookmarkMenu, { once: true }), 0);
}

function applyBulkMove(newCategory) {
    closeBookmarkMenu();
    const urlSet = new Set(selectedBookmarks);
    let moved = 0;
    bookmarks.forEach(b => {
        if (urlSet.has(b.url) && b.category !== newCategory) {
            b.category = newCategory;
            moved++;
        }
    });
    if (moved === 0) {
        showToast('No changes — already in that category.');
        return;
    }
    categories = generateCategoriesFromBookmarks(bookmarks);
    saveBookmarksToStorage('manual');
    renderCategoryTree();
    updateBookmarkDisplay();
    exitSelectionMode();
    showToast(`Moved ${moved} bookmark${moved !== 1 ? 's' : ''} to "${newCategory}".`);
}

// Search Functionality
function handleSearch() {
    searchQuery = searchInput.value.trim();
    
    if (searchQuery === '') {
        if (currentCategory === '') {
            renderBookmarks(bookmarks);
        } else {
            const filteredBookmarks = bookmarks.filter(bookmark => 
                bookmark.category.startsWith(currentCategory)
            );
            renderBookmarks(filteredBookmarks);
        }
        filterControls.style.display = 'none';
        return;
    }
    
    // Show filter controls
    filterControls.style.display = 'flex';
    updateFilterChips();
    
    // Filter bookmarks
    let filteredBookmarks = bookmarks.filter(bookmark => {
        const searchLower = searchQuery.toLowerCase();
        return bookmark.title.toLowerCase().includes(searchLower) ||
               bookmark.description.toLowerCase().includes(searchLower) ||
               bookmark.url.toLowerCase().includes(searchLower) ||
               bookmark.category.toLowerCase().includes(searchLower);
    });
    
    // Apply category filter if one is selected
    if (currentCategory !== '') {
        filteredBookmarks = filteredBookmarks.filter(bookmark => 
            bookmark.category.startsWith(currentCategory)
        );
    }
    
    contextTitle.textContent = `Search Results`;
    renderBookmarks(filteredBookmarks);
    
    // Use AI search if enabled
    if (isAISearch && searchQuery.trim()) {
        performAISearch(searchQuery.trim())
            .then(aiResults => {
                currentBookmarks = aiResults;
                updatePagination();
                renderBookmarks();
            })
            .catch(error => {
                console.error('AI search failed:', error);
                // Fall back to regular search
                const filtered = performRegularSearch(searchQuery);
                currentBookmarks = sortBookmarks(filtered);
                updatePagination();
                renderBookmarks();
            });
        return;
    }
}

function toggleSearchMode() {
    isAISearch = !isAISearch;
    searchToggle.classList.toggle('active', isAISearch);
    
    // Update search placeholder
    searchInput.placeholder = isAISearch ? 
        'Ask AI about your bookmarks...' : 
        'Search bookmarks...';
    
    if (searchQuery) {
        updateBookmarkDisplay(); // Re-run search with new mode
    }
}

async function performAISearch(query) {
    const settings = loadAISettings();
    
    if (!settings || !settings.aiEnabled || !settings.apiKey) {
        console.log('AI search disabled or API key missing');
        return performRegularSearch(query);
    }
    
    try {
        const relevantBookmarks = bookmarks.filter(bookmark => 
            bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
            bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
            (bookmark.description && bookmark.description.toLowerCase().includes(query.toLowerCase()))
        );
        
        if (relevantBookmarks.length === 0) {
            return [];
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: getModelName(settings.aiModel),
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that helps users find relevant bookmarks. Analyze the user query and return the most relevant bookmark indices from the provided list.'
                    },
                    {
                        role: 'user',
                        content: `User query: "${query}"

Available bookmarks:
${relevantBookmarks.map((bookmark, index) => `${index}: ${bookmark.title} - ${bookmark.url}`).join('\n')}

Return only the indices of the most relevant bookmarks as a JSON array of numbers (e.g., [0, 2, 5]). Consider semantic meaning, not just keyword matching.`
                    }
                ],
                temperature: 0.2,
                ...(settings.aiModel.startsWith('gpt-5') ? {} : { max_tokens: 500 })
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        try {
            const indices = JSON.parse(content);
            return indices.map(index => relevantBookmarks[index]).filter(Boolean);
        } catch {
            // Fall back to regular search if AI response is invalid
            return relevantBookmarks.slice(0, 10);
        }
        
    } catch (error) {
        console.error('AI search failed:', error);
        return performRegularSearch(query);
    }
}

function performRegularSearch(query) {
    return bookmarks.filter(bookmark => 
        bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.category.toLowerCase().includes(query.toLowerCase()) ||
        (bookmark.description && bookmark.description.toLowerCase().includes(query.toLowerCase()))
    );
}

function updateFilterChips() {
    const filterChips = filterControls.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => chip.remove());
    
    if (searchQuery) {
        const searchChip = document.createElement('button');
        searchChip.className = 'filter-chip';
        searchChip.textContent = `Search: "${searchQuery}" ×`;
        searchChip.onclick = clearSearch;
        filterControls.appendChild(searchChip);
    }
    
    if (isAISearch) {
        const aiChip = document.createElement('button');
        aiChip.className = 'filter-chip';
        aiChip.textContent = 'AI Search ×';
        aiChip.onclick = toggleSearchMode;
        filterControls.appendChild(aiChip);
    }
}

function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    updateBookmarkDisplay();
}

// View Controls
function setView(view) {
    currentView = view;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Reset to page 1 when changing views
    currentPage = 1;
    
    // Re-render with new view
    renderBookmarks(currentBookmarks);
}

// AI Panel
function toggleAIPanel() {
    const isOpen = aiPanel.classList.contains('open');
    
    if (isOpen) {
        closeAIPanel();
    } else {
        openAIPanel();
    }
}

function openAIPanel() {
    aiPanel.classList.add('open');
    
    // Show backdrop on mobile
    if (window.innerWidth <= 768) {
        const backdrop = document.getElementById('backdrop');
        backdrop.classList.add('show');
    }
}

function closeAIPanel() {
    aiPanel.classList.remove('open');
    
    const backdrop = document.getElementById('backdrop');
    backdrop.classList.remove('show');
}

async function sendAIMessage() {
    const aiInput = document.getElementById('ai-input');
    const aiChat = document.getElementById('ai-chat');
    
    if (!aiInput || !aiChat) return;
    const message = aiInput.value.trim();
    if (!message) return;
    
    // Check AI settings
    const aiSettings = loadAISettings();
    if (!aiSettings || !aiSettings.aiEnabled || !aiSettings.apiKey) {
        showAIError('Please configure your AI settings first.');
        return;
    }
    
    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-message';
    userMessage.innerHTML = `<div class="message user-message">${message}</div>`;
    aiChat.appendChild(userMessage);
    
    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'ai-message typing-indicator';
    typingIndicator.innerHTML = `<div class="message bot-message">🐼 Thinking...</div>`;
    aiChat.appendChild(typingIndicator);
    
    aiInput.value = '';
    aiChat.scrollTop = aiChat.scrollHeight;
    
    try {
        // Send to backend chat endpoint
        const backendUrl = getBackendUrl();
        console.log(`Sending chat request with ${bookmarks.length} bookmarks to backend:`, backendUrl);
        
        const response = await fetch(`${backendUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                bookmarks: bookmarks || [],
                apiKey: aiSettings.apiKey,
                chatModel: aiSettings.chatModel || 'gpt-4o-mini',
                context: {
                    currentCategory: getCurrentCategory(),
                    searchQuery: getLastSearchQuery(),
                    bookmarkCount: bookmarks.length
                }
            })
        });
        
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        if (!response.ok) {
            throw new Error(`Chat API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add bot response
        const botMessage = document.createElement('div');
        botMessage.className = 'ai-message';
        
        let responseHTML = `<div class="message bot-message">${data.response}</div>`;
        
        // Add suggestions if available
        if (data.suggestions && data.suggestions.length > 0) {
            responseHTML += '<div class="ai-suggestions">';
            data.suggestions.forEach(suggestion => {
                responseHTML += `<button class="suggestion-btn" onclick="handleSuggestionClick('${suggestion.replace(/'/g, "\\\'")}')">${suggestion}</button>`;
            });
            responseHTML += '</div>';
        }
        
        // Add results if available (for search intent)
        if (data.results && data.results.length > 0) {
            responseHTML += '<div class="search-results-preview">';
            data.results.slice(0, 5).forEach(bookmark => {
                responseHTML += `
                    <div class="result-item" onclick="openBookmark('${bookmark.url}')">
                        <div class="result-title">${bookmark.title}</div>
                        <div class="result-url">${bookmark.url}</div>
                        <div class="result-category">${bookmark.category || 'Uncategorized'}</div>
                    </div>
                `;
            });
            if (data.results.length > 5) {
                responseHTML += `<div class="result-more">...and ${data.results.length - 5} more results</div>`;
            }
            responseHTML += '</div>';
        }
        
        botMessage.innerHTML = responseHTML;
        aiChat.appendChild(botMessage);
        
        // Handle specific actions
        if (data.action === 'search_results' && data.results) {
            // Update main view with search results
            setTimeout(() => {
                currentBookmarks = data.results;
                updatePagination();
                renderBookmarks();
                const contextTitle = document.getElementById('context-title');
                if (contextTitle) {
                    contextTitle.textContent = `AI Search Results (${data.results.length})`;
                }
            }, 500);
        }
        
        aiChat.scrollTop = aiChat.scrollHeight;
        
    } catch (error) {
        console.error('AI chat error:', error);
        
        // Remove typing indicator
        if (typingIndicator.parentNode) {
            typingIndicator.parentNode.removeChild(typingIndicator);
        }
        
        showAIError(`Sorry, I encountered an error: ${error.message}. Currently have ${bookmarks.length} bookmarks loaded.`);
    }
}

function showAIError(errorMessage) {
    const aiChat = document.getElementById('ai-chat');
    if (!aiChat) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'ai-message';
    errorDiv.innerHTML = `<div class="message bot-message error-message">❌ ${errorMessage}</div>`;
    aiChat.appendChild(errorDiv);
    aiChat.scrollTop = aiChat.scrollHeight;
}

function handleSuggestionClick(suggestion) {
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.value = suggestion;
        sendAIMessage();
    }
}

function getCurrentCategory() {
    const contextTitle = document.getElementById('context-title');
    if (contextTitle && contextTitle.textContent !== 'All Bookmarks') {
        return contextTitle.textContent;
    }
    return null;
}

function getLastSearchQuery() {
    const searchInput = document.getElementById('search-input');
    return searchInput ? searchInput.value.trim() : null;
}

// Sidebar Controls
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
}

// Modal Controls
function showExportModal() {
    document.getElementById('export-modal').style.display = 'flex';
}

function hideExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

function showUploadModal() {
    document.getElementById('upload-modal').style.display = 'flex';
}

function showSettingsModal() {
    document.getElementById('settings-modal').style.display = 'flex';
}

function hideSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

// Reorganize Modal Functions
function showReorganizeModal() {
    if (bookmarks.length === 0) {
        alert('No bookmarks to reorganize. Please upload some bookmarks first.');
        return;
    }
    
    // Check if AI is configured
    const aiSettings = loadAISettings();
    if (!aiSettings || !aiSettings.aiEnabled || !aiSettings.apiKey) {
        alert('Please configure your AI settings first. Go to Settings > AI Settings to add your OpenAI API key.');
        return;
    }
    
    // Update bookmark count in modal
    document.getElementById('bookmark-count-reorganize').textContent = bookmarks.length;
    
    // Show modal
    document.getElementById('reorganize-modal').style.display = 'flex';
}

function hideReorganizeModal() {
    document.getElementById('reorganize-modal').style.display = 'none';
    
    // Reset modal state
    const reorganizeInfo = document.querySelector('.reorganize-info');
    const reorganizeProgress = document.getElementById('reorganize-progress');
    const reorganizeConfirm = document.getElementById('reorganize-confirm');
    const reorganizeCancel = document.getElementById('reorganize-cancel');
    
    if (reorganizeInfo) reorganizeInfo.style.display = 'block';
    if (reorganizeProgress) reorganizeProgress.style.display = 'none';
    if (reorganizeConfirm) reorganizeConfirm.style.display = 'inline-block';
    if (reorganizeCancel) reorganizeCancel.textContent = 'Cancel';
}

let reorganizationSessionId = null;

async function startReorganization() {
    const aiSettings = loadAISettings() || {};
    if (!aiSettings.apiKey && !aiSettings.geminiApiKey && !backendHasAnyKey()) {
        alert('API key not found. Add one in AI settings or set OPENAI_API_KEY / GOOGLE_GEMINI_API_KEY in the backend .env.');
        return;
    }

    const depth = document.getElementById('reorganize-depth').value;
    
    // Generate session ID
    reorganizationSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Switch to progress view
    const reorganizeInfo = document.querySelector('.reorganize-info');
    const reorganizeProgress = document.getElementById('reorganize-progress');
    const reorganizeConfirm = document.getElementById('reorganize-confirm');
    const reorganizeCancel = document.getElementById('reorganize-cancel');
    
    if (reorganizeInfo) reorganizeInfo.style.display = 'none';
    if (reorganizeProgress) reorganizeProgress.style.display = 'block';
    if (reorganizeConfirm) reorganizeConfirm.style.display = 'none';
    if (reorganizeCancel) reorganizeCancel.textContent = 'Close';
    
    try {
        // Test connection first
        const connectionTest = await testBackendConnection();
        if (!connectionTest.connected) {
            throw new Error(`Backend not available: ${connectionTest.error}`);
        }
        
        const backendUrl = getBackendUrl();
        console.log('Starting reorganization with backend:', backendUrl);
        
        // Start reorganization
        const response = await fetch(`${backendUrl}/api/reorganize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookmarks: bookmarks,
                apiKey: aiSettings.apiKey || aiSettings.geminiApiKey || '',
                model: aiSettings.reorganizeModel || 'gpt-5-mini',
                categorizationDepth: depth,
                sessionId: reorganizationSessionId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Reorganization started:', result);
        
        // Start polling for progress
        pollReorganizationProgress();
        
    } catch (error) {
        console.error('Error starting reorganization:', error);
        let errorMessage = 'Failed to start reorganization.';
        
        if (error.message.includes('Backend not available')) {
            errorMessage = 'AI service is not available. Please try again in a moment.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Connection to AI service failed. Please check your internet connection.';
        } else if (error.message.includes('API key')) {
            errorMessage = 'Invalid API key. Please check your OpenAI settings.';
        }
        
        showReorganizationError(errorMessage);
    }
}

async function pollReorganizationProgress() {
    if (!reorganizationSessionId) return;
    
    try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/progress/${reorganizationSessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const progress = await response.json();
        updateProgressDisplay(progress);
        
        if (progress.status === 'completed') {
            await handleReorganizationComplete();
        } else if (progress.status === 'error') {
            showReorganizationError(progress.message);
        } else {
            // Continue polling
            setTimeout(pollReorganizationProgress, 2000);
        }
        
    } catch (error) {
        console.error('Error polling progress:', error);
        showReorganizationError('Lost connection to reorganization service.');
    }
}

function updateProgressDisplay(progress) {
    const progressFill = document.getElementById('reorganize-progress-fill');
    const progressText = document.getElementById('reorganize-progress-text');
    
    progressFill.style.width = `${progress.progress}%`;
    progressText.textContent = progress.message;
    
    console.log(`Progress: ${progress.progress}% - ${progress.message}`);
}

async function handleReorganizationComplete() {
    try {
        // Get the reorganized bookmarks
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/result/${reorganizationSessionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update local bookmarks with new categories
        bookmarks = result.bookmarks;
        
        // Regenerate categories structure
        categories = generateCategoriesFromBookmarks(bookmarks);
        
        // Save to localStorage
        saveBookmarksToStorage();
        
        // Update UI
        renderCategoryTree();
        updateBookmarkDisplay();
        
        // Show success message
        document.getElementById('reorganize-progress-text').textContent = 
            `Successfully reorganized ${bookmarks.length} bookmarks!`;
        
        // Update button text
        document.getElementById('reorganize-cancel').textContent = 'Done';
        
        console.log('Reorganization completed successfully');
        
    } catch (error) {
        console.error('Error getting reorganization result:', error);
        showReorganizationError('Failed to apply reorganization results.');
    }
}

function showReorganizationError(message) {
    const progressText = document.getElementById('reorganize-progress-text');
    const progressIcon = document.querySelector('.reorganize-progress .progress-icon');
    
    progressIcon.textContent = '❌';
    progressIcon.style.animation = 'none';
    progressText.textContent = message;
    progressText.style.color = '#dc2626';
    
    document.getElementById('reorganize-cancel').textContent = 'Close';
}

// Export functionality
function exportBookmarks(format) {
    const includeCategories = document.getElementById('include-categories-export').checked;
    const includeDescriptions = document.getElementById('include-descriptions-export').checked;
    
    console.log(`Exporting bookmarks as ${format.toUpperCase()}`);
    console.log('Include categories:', includeCategories);
    console.log('Include descriptions:', includeDescriptions);
    
    // In a real application, this would generate and download the file
    alert(`Exporting ${bookmarks.length} bookmarks as ${format.toUpperCase()} file...\n\nOptions:\n- Categories: ${includeCategories ? 'Included' : 'Excluded'}\n- Descriptions: ${includeDescriptions ? 'Included' : 'Excluded'}`);
    
    hideExportModal();
}

function hideUploadModal() {
    document.getElementById('upload-modal').style.display = 'none';
    resetUploadArea();
    switchImportTab('file');
}

function switchImportTab(tabName) {
    document.querySelectorAll('.import-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.import-tab-content').forEach(panel => panel.classList.remove('active'));
    const btn = document.querySelector(`.import-tab-btn[data-tab="${tabName}"]`);
    const panel = document.getElementById(tabName === 'file' ? 'import-file-tab' : 'import-chrome-sync-tab');
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
}

function closeAllPanels() {
    closeAIPanel();
}

// File Upload Handling
function handleFileDrop(event) {
    event.preventDefault();
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processUploadedFile(files[0]);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    const uploadArea = document.getElementById('upload-area');
    uploadArea.classList.remove('dragover');
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processUploadedFile(files[0]);
    }
}

function processUploadedFile(file) {
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
        alert('Please select an HTML bookmark file.');
        return;
    }
    
    console.log('Processing file:', file.name);
    
    // Show processing state
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">⏳</div>
        <div class="upload-text">Processing bookmarks...</div>
        <div class="upload-subtext">Parsing ${file.name}</div>
    `;
    
    // Read and parse the file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const htmlContent = e.target.result;
            const parsedBookmarks = parseBookmarkFile(htmlContent);

            if (parsedBookmarks.length === 0) {
                showUploadError('No bookmarks found in the file. Please check the file format.');
                return;
            }

            // Deduplicate against existing bookmarks then send to review
            const existingUrls = new Set(bookmarks.map(b => b.url));
            const newBookmarks = parsedBookmarks.filter(b => !existingUrls.has(b.url));

            if (newBookmarks.length === 0) {
                showUploadError('All bookmarks in this file are already in your collection.');
                return;
            }

            hideUploadModal();
            showImportReviewModal(newBookmarks, 'file_import');
        } catch (error) {
            console.error('Error parsing bookmark file:', error);
            showUploadError('Error parsing bookmark file. Please ensure it\'s a valid HTML bookmark export.');
        }
    };
    
    reader.onerror = function() {
        showUploadError('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

function handleChromeJsonSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">⏳</div>
        <div class="upload-text">Processing bookmarks...</div>
        <div class="upload-subtext">Reading Chrome bookmarks file</div>
    `;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const parsed = parseChromeBookmarksJson(data);

            if (parsed.length === 0) {
                showUploadError('No bookmarks found in the Chrome bookmarks file.');
                return;
            }

            finalizeBookmarkImport(parsed);
        } catch (err) {
            console.error('Error reading Chrome bookmarks:', err);
            showUploadError('Could not parse the Chrome bookmarks file. Make sure you selected the correct file.');
        }
    };
    reader.onerror = function() {
        showUploadError('Error reading file. Please try again.');
    };
    reader.readAsText(files[0]);
}

function parseChromeBookmarksJson(data) {
    const results = [];
    const skipNames = new Set(['Bookmarks bar', 'Other bookmarks', 'Synced bookmarks', 'Mobile bookmarks']);

    function walk(node, pathParts) {
        if (node.type === 'url') {
            let dateAdded = null;
            if (node.date_added) {
                // Windows FILETIME: microseconds since 1601-01-01
                const ms = Number(BigInt(node.date_added) / 1000n) - 11644473600000;
                dateAdded = new Date(ms);
            }
            results.push({
                title: node.name || 'Untitled',
                url: node.url,
                description: '',
                category: pathParts.join(' / '),
                dateAdded: dateAdded || new Date(),
                favicon: getFaviconUrl(node.url)
            });
        } else if (node.type === 'folder' && Array.isArray(node.children)) {
            const label = skipNames.has(node.name) ? null : node.name;
            const nextPath = label ? [...pathParts, label] : pathParts;
            for (const child of node.children) {
                walk(child, nextPath);
            }
        }
    }

    if (data && data.roots) {
        for (const root of Object.values(data.roots)) {
            walk(root, []);
        }
    }
    return results;
}

function finalizeBookmarkImport(parsedBookmarks) {
    // Deduplicate then send to review modal
    const existingUrls = new Set(bookmarks.map(b => b.url));
    const newBookmarks = parsedBookmarks.filter(b => !existingUrls.has(b.url));

    if (newBookmarks.length === 0) {
        showUploadError('All bookmarks are already in your collection.');
        return;
    }

    hideUploadModal();
    showImportReviewModal(newBookmarks, 'file_import');
}

function parseBookmarkFile(htmlContent) {
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const bookmarksList = [];
    
    // Find all bookmark links
    const links = doc.querySelectorAll('a[href]');
    
    links.forEach(link => {
        const url = link.getAttribute('href');
        const title = link.textContent.trim();
        
        // Skip empty or invalid URLs
        if (!url || !title || url.startsWith('javascript:')) {
            return;
        }
        
        // Get folder path from DOM structure
        const category = extractCategoryFromElement(link);
        
        // Get additional attributes
        const addDate = link.getAttribute('add_date');
        const description = link.getAttribute('description') || '';
        
        const bookmark = {
            title: title,
            url: url,
            description: description,
            category: category || 'Uncategorized',
            dateAdded: addDate ? new Date(parseInt(addDate) * 1000) : new Date(),
            favicon: getFaviconUrl(url)
        };
        
        bookmarksList.push(bookmark);
    });
    
    return bookmarksList;
}

function extractCategoryFromElement(linkElement) {
    const categoryPath = [];
    let current = linkElement.parentElement;
    
    // Walk up the DOM tree to find folder structure
    while (current && current !== document) {
        // Look for dt elements that contain folder names
        if (current.tagName === 'DT') {
            const h3 = current.querySelector('h3');
            if (h3 && h3.textContent.trim()) {
                categoryPath.unshift(h3.textContent.trim());
            }
        }
        
        // Look for dl elements that represent folder contents
        if (current.tagName === 'DL') {
            const prevSibling = current.previousElementSibling;
            if (prevSibling && prevSibling.tagName === 'DT') {
                const h3 = prevSibling.querySelector('h3');
                if (h3 && h3.textContent.trim()) {
                    categoryPath.unshift(h3.textContent.trim());
                }
            }
        }
        
        current = current.parentElement;
    }
    
    // Remove common folder names and clean up
    const cleanPath = categoryPath.filter(name => 
        name !== 'Bookmarks bar' && 
        name !== 'Bookmarks Menu' && 
        name !== 'Other bookmarks' &&
        name !== 'Favorites' &&
        name.length > 0
    );
    
    return cleanPath.length > 0 ? cleanPath.join(' / ') : 'Uncategorized';
}

function generateCategoriesFromBookmarks(bookmarksList) {
    const categoryStructure = {};
    
    bookmarksList.forEach(bookmark => {
        const categoryPath = bookmark.category.split(' / ');
        let current = categoryStructure;
        
        // Build nested category structure
        categoryPath.forEach((categoryName, index) => {
            if (!current[categoryName]) {
                current[categoryName] = {
                    bookmarks: 0,
                    children: {}
                };
            }
            
            // Count bookmarks at each level
            if (index === categoryPath.length - 1) {
                current[categoryName].bookmarks++;
            }
            
            current = current[categoryName].children;
        });
    });
    
    return categoryStructure;
}

function showAIProcessing(count) {
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">🤖</div>
        <div class="upload-text">AI is organizing your bookmarks...</div>
        <div class="upload-subtext">Analyzing ${count} bookmarks with AI</div>
    `;
}

function showUploadSuccess(count, withAI = false) {
    const uploadArea = document.getElementById('upload-area');
    const aiText = withAI ? ' with AI categorization' : '';
    uploadArea.innerHTML = `
        <div class="upload-icon">✅</div>
        <div class="upload-text">Success!</div>
        <div class="upload-subtext">Processed ${count} bookmarks${aiText}</div>
    `;
}

function showUploadError(message) {
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">❌</div>
        <div class="upload-text">Upload Error</div>
        <div class="upload-subtext">${message}</div>
        <button class="upload-button" onclick="resetUploadArea()" style="margin-top: 16px;">Try Again</button>
    `;
}

function resetUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    uploadArea.classList.remove('dragover');
    fileInput.value = '';
    
    uploadArea.innerHTML = `
        <input type="file" id="file-input" class="hidden-file-input" accept=".html,.htm" onchange="handleFileSelect(event)">
        <div class="upload-icon">📤</div>
        <div class="upload-text">Drag and drop your bookmark HTML file here</div>
        <div class="upload-subtext">Or click to browse files</div>
        <button class="upload-button" onclick="(function(){ const fi = document.getElementById('file-input'); if(fi) fi.click(); })()">
            📁 Select File
        </button>
    `;
}

// Responsive handling
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        const backdrop = document.getElementById('backdrop');
        backdrop.classList.remove('show');
    }
});

// Make upload area clickable
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('click', function() {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
});

// Settings Tab Management
function switchSettingsTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Remove active class from all tabs and content
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-tab`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
    
    // Load AI settings when switching to AI tab
    if (tabName === 'ai') {
        setTimeout(() => {
            const settings = JSON.parse(localStorage.getItem('pinpanda_ai_settings') || '{}');
            
            const aiEnabled = document.getElementById('ai-enabled');
            const reorganizeModel = document.getElementById('reorganize-model');
            const chatModel = document.getElementById('chat-model');
            const apiKey = document.getElementById('openai-api-key');
            const categorizationDepth = document.getElementById('categorization-depth');
            
            if (aiEnabled && settings.aiEnabled !== undefined) aiEnabled.checked = settings.aiEnabled;
            if (reorganizeModel && (settings.reorganizeModel || settings.aiModel)) reorganizeModel.value = settings.reorganizeModel || settings.aiModel;
            if (chatModel && settings.chatModel) chatModel.value = settings.chatModel;
            if (apiKey && settings.apiKey) apiKey.value = settings.apiKey;
            if (categorizationDepth && settings.categorizationDepth) categorizationDepth.value = settings.categorizationDepth;
        }, 50);
    }
}

// Theme Selection
function selectTheme(theme) {
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
    });
    document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
    
    // In a real app, this would apply the theme
    console.log('Theme changed to:', theme);
}

// Settings form handlers
document.addEventListener('DOMContentLoaded', function() {
    // Theme option click handlers
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function() {
            const theme = this.dataset.theme;
            selectTheme(theme);
        });
    });
    
    // Form change handlers for persistence
    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('change', function(e) {
            // In a real app, this would save settings to localStorage
            console.log('Setting changed:', e.target.id, e.target.value || e.target.checked);
        });
    }
});

// Close modals when clicking outside
window.addEventListener('click', function(e) {
    const exportModal = document.getElementById('export-modal');
    const uploadModal = document.getElementById('upload-modal');
    const settingsModal = document.getElementById('settings-modal');
    
    if (e.target === exportModal) {
        hideExportModal();
    }
    
    if (e.target === uploadModal) {
        hideUploadModal();
    }
    
    if (e.target === settingsModal) {
        hideSettingsModal();
    }
});
// Empty State Management
function updateBookmarkDisplay() {
    if (bookmarks.length === 0) {
        showEmptyBookmarkState();
        updateContextInfo('All Bookmarks', 0);
        return;
    }
    
    let filteredBookmarks = bookmarks;
    
    // Apply search filter
    if (searchQuery) {
        filteredBookmarks = bookmarks.filter(bookmark => {
            const searchLower = searchQuery.toLowerCase();
            return bookmark.title.toLowerCase().includes(searchLower) ||
                   bookmark.description.toLowerCase().includes(searchLower) ||
                   bookmark.category.toLowerCase().includes(searchLower);
        });
    }
    
    // Apply category filter
    if (currentCategory && currentCategory !== '') {
        filteredBookmarks = filteredBookmarks.filter(bookmark => 
            bookmark.category.startsWith(currentCategory)
        );
    }
    
    currentBookmarks = filteredBookmarks;
    renderBookmarks(filteredBookmarks);
    
    const categoryName = currentCategory || 'All Bookmarks';
    updateContextInfo(categoryName, filteredBookmarks.length);
}

function showEmptyBookmarkState() {
    bookmarksContainer.innerHTML = `
        <div class="bookmarks-empty-state">
            <div class="empty-icon">📚</div>
            <h3>No bookmarks yet</h3>
            <p>Upload your browser bookmarks to get started with AI-powered organization and intelligent categorization.</p>
            <div class="empty-state-actions">
                <button class="btn-primary" onclick="showUploadModal()">📤 Upload Bookmarks</button>
                <button class="btn-secondary" onclick="showHelpInfo()">❓ How to export bookmarks</button>
            </div>
        </div>
    `;
}

function showHelpInfo() {
    alert('To export bookmarks from your browser:\n\n1. Chrome/Edge: Go to Bookmarks → Bookmark Manager → ⋮ → Export bookmarks\n2. Firefox: Go to Bookmarks → Manage Bookmarks → Import and Backup → Export\n3. Safari: Go to File → Export Bookmarks\n\nThen upload the exported HTML file here!');
}

function updateContextInfo(title, count) {
    if (contextTitle) contextTitle.textContent = title;
    if (bookmarkCount) bookmarkCount.textContent = `${count} bookmark${count !== 1 ? 's' : ''}`;
}

// Drag and Drop Functions
function handleBookmarkDragStart(event, bookmark) {
    console.log('Starting drag for:', bookmark.title);
    
    let draggedBookmarks = [];
    
    // Check if this bookmark is part of a selection
    if (selectionMode && selectedBookmarks.has(bookmark.url)) {
        // Dragging selected items - collect all selected bookmarks
        draggedBookmarks = bookmarks.filter(b => selectedBookmarks.has(b.url));
        console.log(`Dragging ${draggedBookmarks.length} selected bookmarks`);
    } else {
        // Single bookmark drag
        draggedBookmarks = [bookmark];
    }
    
    // Store bookmark data in the drag event
    event.dataTransfer.setData('application/json', JSON.stringify(draggedBookmarks));
    event.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback
    event.target.classList.add('dragging');
    
    // If dragging multiple items, add visual feedback to all selected items
    if (draggedBookmarks.length > 1) {
        document.querySelectorAll('.bookmark-item.selected, .bookmarks-table-row.selected').forEach(element => {
            element.classList.add('dragging-multi');
        });
        
        // Create a drag image showing count
        createMultiDragImage(event, draggedBookmarks.length);
    }
}

function handleBookmarkDragEnd(event) {
    console.log('Drag ended');
    
    // Remove visual feedback
    event.target.classList.remove('dragging');
    
    // Remove multi-drag visual feedback
    document.querySelectorAll('.dragging-multi').forEach(element => {
        element.classList.remove('dragging-multi');
    });
    
    // Clean up any remaining drop zone highlights
    document.querySelectorAll('.category-item.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleCategoryDragOver(event, categoryPath) {
    event.preventDefault(); // Allow drop
    event.dataTransfer.dropEffect = 'move';
    
    // Add visual feedback
    event.currentTarget.classList.add('drag-over');
}

function handleCategoryDragLeave(event) {
    // Remove visual feedback
    event.currentTarget.classList.remove('drag-over');
}

function handleCategoryDrop(event, categoryPath) {
    event.preventDefault();
    
    // Remove visual feedback
    event.currentTarget.classList.remove('drag-over');
    
    console.log('Dropped on category:', categoryPath);
    
    // Get the bookmark data
    try {
        const draggedBookmarks = JSON.parse(event.dataTransfer.getData('application/json'));
        
        // Handle both single bookmark and array of bookmarks
        const bookmarksToMove = Array.isArray(draggedBookmarks) ? draggedBookmarks : [draggedBookmarks];
        
        console.log(`Moving ${bookmarksToMove.length} bookmark(s) to category:`, categoryPath);
        
        // Update all bookmarks' categories
        updateMultipleBookmarkCategories(bookmarksToMove, categoryPath || 'Uncategorized');
        
    } catch (error) {
        console.error('Error parsing dropped data:', error);
    }
}

function updateBookmarkCategory(draggedBookmark, newCategoryPath) {
    console.log('Updating bookmark category:', draggedBookmark.title, 'to:', newCategoryPath);
    
    // Find the bookmark in the bookmarks array by URL and title (unique combination)
    const bookmarkIndex = bookmarks.findIndex(bookmark => 
        bookmark.url === draggedBookmark.url && bookmark.title === draggedBookmark.title
    );
    
    if (bookmarkIndex === -1) {
        console.error('Bookmark not found in array');
        return;
    }
    
    const oldCategory = bookmarks[bookmarkIndex].category;
    
    // Don't update if it's the same category
    if (oldCategory === newCategoryPath) {
        console.log('Bookmark is already in this category');
        return;
    }
    
    // Update the bookmark's category
    bookmarks[bookmarkIndex].category = newCategoryPath;
    
    console.log(`Moved "${draggedBookmark.title}" from "${oldCategory}" to "${newCategoryPath}"`);
    
    // Save to localStorage
    saveBookmarksToStorage();
    
    // Regenerate category structure
    categories = generateCategoriesFromBookmarks(bookmarks);
    
    // Update the UI
    renderCategoryTree();
    updateBookmarkDisplay();
    
    // Show success feedback
    showMoveSuccessMessage(draggedBookmark.title, newCategoryPath);
}

function updateMultipleBookmarkCategories(draggedBookmarks, newCategoryPath) {
    console.log(`Updating ${draggedBookmarks.length} bookmark categories to:`, newCategoryPath);
    
    let movedCount = 0;
    const movedTitles = [];
    
    draggedBookmarks.forEach(draggedBookmark => {
        // Find the bookmark in the bookmarks array by URL and title (unique combination)
        const bookmarkIndex = bookmarks.findIndex(bookmark => 
            bookmark.url === draggedBookmark.url && bookmark.title === draggedBookmark.title
        );
        
        if (bookmarkIndex !== -1) {
            const oldCategory = bookmarks[bookmarkIndex].category;
            
            // Don't update if it's the same category
            if (oldCategory !== newCategoryPath) {
                bookmarks[bookmarkIndex].category = newCategoryPath;
                movedCount++;
                movedTitles.push(draggedBookmark.title);
                
                console.log(`Moved "${draggedBookmark.title}" from "${oldCategory}" to "${newCategoryPath}"`);
            }
        }
    });
    
    if (movedCount > 0) {
        // Save to localStorage
        saveBookmarksToStorage();
        
        // Regenerate category structure
        categories = generateCategoriesFromBookmarks(bookmarks);
        
        // Update the UI
        renderCategoryTree();
        updateBookmarkDisplay();
        
        // Show success feedback
        showMultipleMoveSuccessMessage(movedCount, movedTitles, newCategoryPath);
        
        // Clear selection if we moved selected items
        if (selectionMode && movedCount > 0) {
            // Remove moved bookmarks from selection
            draggedBookmarks.forEach(bookmark => {
                selectedBookmarks.delete(bookmark.url);
            });
            
            // Exit selection mode if no items remain selected
            if (selectedBookmarks.size === 0) {
                exitSelectionMode();
            } else {
                updateSelectionUI();
                updateBookmarkSelectionStyles();
            }
        }
    }
}

function showMultipleMoveSuccessMessage(count, titles, categoryPath) {
    // Create a temporary success message
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        max-width: 350px;
    `;
    
    if (count === 1) {
        message.textContent = `Moved "${titles[0]}" to "${categoryPath}"`;
    } else {
        message.innerHTML = `
            <div style="font-weight: bold;">Moved ${count} bookmarks to "${categoryPath}"</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
                ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ` and ${titles.length - 2} others` : ''}
            </div>
        `;
    }
    
    document.body.appendChild(message);
    
    // Remove the message after 4 seconds (longer for multiple items)
    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 4000);
}

function showMoveSuccessMessage(bookmarkTitle, categoryPath) {
    // Create a temporary success message
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
    `;
    
    message.textContent = `Moved "${bookmarkTitle}" to "${categoryPath}"`;
    document.body.appendChild(message);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 3000);
}

// Selection Management Functions
function handleBookmarkSelection(event, bookmarkUrl) {
    event.stopPropagation(); // Prevent triggering other click handlers
    
    if (!selectionMode) {
        enterSelectionMode();
    }
    
    if (event.target.checked) {
        selectedBookmarks.add(bookmarkUrl);
    } else {
        selectedBookmarks.delete(bookmarkUrl);
    }
    
    updateSelectionUI();
    updateBookmarkSelectionStyles();
}

function enterSelectionMode() {
    selectionMode = true;
    document.body.classList.add('selection-mode');
    document.getElementById('selection-controls').style.display = 'flex';
    document.getElementById('bulk-actions-bar').style.display = 'flex';
}

function exitSelectionMode() {
    selectionMode = false;
    selectedBookmarks.clear();
    document.body.classList.remove('selection-mode');
    document.getElementById('selection-controls').style.display = 'none';
    document.getElementById('bulk-actions-bar').style.display = 'none';
    updateSelectionUI();
    updateBookmarkSelectionStyles();
}

function selectAllBookmarks() {
    // Select all visible bookmarks
    currentBookmarks.forEach(bookmark => {
        selectedBookmarks.add(bookmark.url);
    });
    
    // Update checkboxes
    document.querySelectorAll('.selection-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    updateSelectionUI();
    updateBookmarkSelectionStyles();
}

function selectNoneBookmarks() {
    selectedBookmarks.clear();
    
    // Update checkboxes
    document.querySelectorAll('.selection-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    updateSelectionUI();
    updateBookmarkSelectionStyles();
    
    // Exit selection mode if nothing is selected
    if (selectedBookmarks.size === 0) {
        exitSelectionMode();
    }
}

function updateSelectionUI() {
    const selectionCount = document.getElementById('selection-count');
    const bulkActionsText = document.getElementById('bulk-actions-text');
    const count = selectedBookmarks.size;
    
    if (selectionCount) {
        selectionCount.textContent = `${count} selected`;
    }
    
    if (bulkActionsText) {
        bulkActionsText.textContent = `${count} bookmark${count !== 1 ? 's' : ''} selected`;
    }
}

function updateBookmarkSelectionStyles() {
    // Update grid items
    document.querySelectorAll('.bookmark-item').forEach(item => {
        const checkbox = item.querySelector('.selection-checkbox');
        if (checkbox && checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    // Update table rows
    document.querySelectorAll('.bookmarks-table-row').forEach(row => {
        const checkbox = row.querySelector('.selection-checkbox');
        if (checkbox && checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

function createMultiDragImage(event, count) {
    // Create a small element to use as drag image
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 10000;
    `;
    dragImage.textContent = `${count} items`;
    
    document.body.appendChild(dragImage);
    
    // Set as drag image
    event.dataTransfer.setDragImage(dragImage, 50, 20);
    
    // Remove after a short delay
    setTimeout(() => {
        if (dragImage.parentNode) {
            dragImage.parentNode.removeChild(dragImage);
        }
    }, 1);
}

// ── Chrome Sync ──────────────────────────────────────────────────────────────

async function syncChrome() {
    const statusEl = document.getElementById('chrome-sync-status');
    if (statusEl) statusEl.textContent = 'Syncing…';

    try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/chrome-bookmarks`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || res.statusText);
        }
        const data = await res.json();
        const incoming = parseChromeBookmarksJson(data);
        const existingUrls = new Set(bookmarks.map(b => b.url));
        const newOnes = incoming.filter(b => !existingUrls.has(b.url));

        if (statusEl) statusEl.textContent = 'Connected — last synced just now.';

        if (newOnes.length === 0) {
            showToast('Already up to date — no new Chrome bookmarks found.');
            return;
        }

        showImportReviewModal(newOnes, 'chrome_sync');
    } catch (err) {
        console.error('Chrome sync error:', err);
        if (statusEl) statusEl.textContent = 'Sync failed: ' + err.message;
        alert('Chrome sync failed: ' + err.message + '\n\nMake sure the PinPanda backend is running.');
    }
}

// ── Import Review Modal ───────────────────────────────────────────────────────

function showImportReviewModal(newBookmarks, source) {
    importReviewBookmarks = newBookmarks.map((b, i) => ({ ...b, _checked: true, _idx: i }));
    importReviewSource = source;

    const aiSettings = loadAISettings();
    const aiAvailable = aiSettings && aiSettings.aiEnabled && aiSettings.apiKey;
    const aiBtn = document.getElementById('import-review-ai-btn');
    if (aiBtn) aiBtn.disabled = !aiAvailable;

    renderImportReviewList();
    document.getElementById('import-review-modal').style.display = 'flex';
}

function hideImportReviewModal() {
    document.getElementById('import-review-modal').style.display = 'none';
    importReviewBookmarks = [];
}

function renderImportReviewList() {
    const listEl = document.getElementById('import-review-list');
    const countEl = document.getElementById('import-review-count');
    const checkedCount = importReviewBookmarks.filter(b => b._checked).length;
    countEl.textContent = `${checkedCount} of ${importReviewBookmarks.length} selected`;

    listEl.innerHTML = importReviewBookmarks.map((b, i) => {
        let domain = '';
        try { domain = new URL(b.url).hostname; } catch (_) {}
        const title = escapeHtml(b.title || b.url);
        const domainSafe = escapeHtml(domain);
        const favicon = b.favicon ? `<img class="import-review-favicon" src="${b.favicon}" onerror="this.style.display='none'">` : '<span class="import-review-favicon-placeholder"></span>';
        return `<div class="import-review-row">
            <input type="checkbox" ${b._checked ? 'checked' : ''} onchange="toggleImportReviewRow(${i}, this.checked)">
            ${favicon}
            <span class="import-review-title" title="${title}">${title}</span>
            <span class="import-review-domain">${domainSafe}</span>
            <button type="button" class="import-review-remove" onclick="removeImportReviewRow(${i})" title="Remove">×</button>
        </div>`;
    }).join('');
}

function toggleImportReviewRow(index, checked) {
    if (importReviewBookmarks[index]) {
        importReviewBookmarks[index]._checked = checked;
        const countEl = document.getElementById('import-review-count');
        const checkedCount = importReviewBookmarks.filter(b => b._checked).length;
        countEl.textContent = `${checkedCount} of ${importReviewBookmarks.length} selected`;
    }
}

function removeImportReviewRow(index) {
    importReviewBookmarks.splice(index, 1);
    renderImportReviewList();
    if (importReviewBookmarks.length === 0) hideImportReviewModal();
}

function selectAllImportReview(checked) {
    importReviewBookmarks.forEach(b => b._checked = checked);
    renderImportReviewList();
}

function getCheckedImportBookmarks() {
    return importReviewBookmarks
        .filter(b => b._checked)
        .map(({ _checked, _idx, ...b }) => b);
}

function confirmImportWithoutAI() {
    const selected = getCheckedImportBookmarks();
    if (selected.length === 0) { alert('No bookmarks selected.'); return; }
    bookmarks = [...bookmarks, ...selected];
    categories = generateCategoriesFromBookmarks(bookmarks);
    saveBookmarksToStorage(importReviewSource);
    renderCategoryTree();
    updateBookmarkDisplay();
    updateReorganizeButton();
    hideImportReviewModal();
    showToast(`Added ${selected.length} bookmark${selected.length !== 1 ? 's' : ''}.`);
}

function confirmImportWithAI() {
    const selected = getCheckedImportBookmarks();
    if (selected.length === 0) { alert('No bookmarks selected.'); return; }

    hideImportReviewModal();
    const source = importReviewSource;

    // Show processing indicator
    showToast(`Processing ${selected.length} bookmark${selected.length !== 1 ? 's' : ''} with AI…`);

    categorizeBookmarksWithAI(selected)
        .then(aiCategories => {
            // Merge AI categories into existing, assign categories to selected bookmarks
            const catMap = {};
            function flattenCats(cats, prefix) {
                for (const [cat, val] of Object.entries(cats)) {
                    const fullCat = prefix ? `${prefix} / ${cat}` : cat;
                    if (Array.isArray(val.bookmarks)) {
                        val.bookmarks.forEach(i => { if (selected[i]) catMap[i] = fullCat; });
                    }
                    if (val.subcategories) flattenCats(val.subcategories, fullCat);
                }
            }
            flattenCats(aiCategories, '');
            selected.forEach((b, i) => { b.category = catMap[i] || b.category || 'Uncategorized'; });
            bookmarks = [...bookmarks, ...selected];
            categories = generateCategoriesFromBookmarks(bookmarks);
            saveBookmarksToStorage(source);
            renderCategoryTree();
            updateBookmarkDisplay();
            updateReorganizeButton();
            showToast(`Added ${selected.length} bookmark${selected.length !== 1 ? 's' : ''} with AI categorization.`);
        })
        .catch(err => {
            console.error('AI categorization failed:', err);
            bookmarks = [...bookmarks, ...selected];
            categories = generateCategoriesFromBookmarks(bookmarks);
            saveBookmarksToStorage(source);
            renderCategoryTree();
            updateBookmarkDisplay();
            updateReorganizeButton();
            showToast(`Added ${selected.length} bookmark${selected.length !== 1 ? 's' : ''} (AI categorization failed, used folders).`);
        });
}


function showToast(message) {
    const existing = document.getElementById('pp-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'pp-toast';
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: '#333', color: '#fff', padding: '10px 20px',
        borderRadius: '6px', fontSize: '14px', zIndex: '99999',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
