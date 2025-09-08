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

// Local Storage Functions
function saveBookmarksToStorage() {
    try {
        localStorage.setItem('pinpanda_bookmarks', JSON.stringify(bookmarks));
        localStorage.setItem('pinpanda_categories', JSON.stringify(categories));
        console.log('Bookmarks saved to storage');
    } catch (error) {
        console.error('Error saving bookmarks to storage:', error);
    }
}

function loadBookmarksFromStorage() {
    try {
        const savedBookmarks = localStorage.getItem('pinpanda_bookmarks');
        const savedCategories = localStorage.getItem('pinpanda_categories');
        
        if (savedBookmarks) {
            bookmarks = JSON.parse(savedBookmarks);
            // Convert date strings back to Date objects
            bookmarks.forEach(bookmark => {
                if (bookmark.dateAdded && typeof bookmark.dateAdded === 'string') {
                    bookmark.dateAdded = new Date(bookmark.dateAdded);
                }
            });
            console.log(`Loaded ${bookmarks.length} bookmarks from storage`);
        }
        
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
            console.log('Loaded categories from storage');
        }
        
        return bookmarks.length > 0;
    } catch (error) {
        console.error('Error loading bookmarks from storage:', error);
        return false;
    }
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
    // Load existing bookmarks from storage
    loadBookmarksFromStorage();
    
    renderCategoryTree();
    updateBookmarkDisplay();
    setupEventListeners();
});

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
                sendAIMessage();
            }
        });
    }
}

// Render Category Tree
function renderCategoryTree() {
    categoryTree.innerHTML = '';
    
    // Add "All Bookmarks" option
    const allItem = createCategoryItem('All Bookmarks', bookmarks.length, '', true);
    categoryTree.appendChild(allItem);
    
    // Render categories
    Object.entries(categories).forEach(([name, data]) => {
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
        
        Object.entries(data.children).forEach(([childName, childData]) => {
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
    item.onclick = () => window.open(bookmark.url, '_blank');
    
    item.innerHTML = `
        <a href="${bookmark.url}" class="bookmark-title" target="_blank" onclick="event.stopPropagation()">
            ${bookmark.title}
        </a>
        <div class="bookmark-url">${bookmark.url}</div>
        <div class="bookmark-description">${bookmark.description}</div>
        <div class="bookmark-category">${bookmark.category}</div>
    `;
    
    return item;
}

function createBookmarkTableRow(bookmark) {
    const row = document.createElement('tr');
    row.className = 'bookmarks-table-row';
    
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
    
    row.innerHTML = `
        <td class="bookmarks-table-cell">
            <div class="bookmark-name-cell">
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
            <div class="bookmark-category-cell">
                ${categoryTags}
            </div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-date">${dateFormatted}</div>
        </td>
        <td class="bookmarks-table-cell">
            <div class="bookmark-actions">
                <button class="action-btn" onclick="window.open('${bookmark.url}', '_blank')" title="Open">
                    ↗
                </button>
                <button class="action-btn" onclick="showBookmarkMenu(event)" title="More options">
                    ⋯
                </button>
            </div>
        </td>
    `;
    
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

function handleSort(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }
    
    renderBookmarks(currentBookmarks);
}

function showBookmarkMenu(event) {
    event.stopPropagation();
    // Placeholder for bookmark context menu
    console.log('Show bookmark menu');
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
    
    // Simulate AI search if enabled
    if (isAISearch) {
        setTimeout(() => {
            // In a real implementation, this would call the AI service
            console.log('AI search enhanced results for:', searchQuery);
        }, 500);
    }
}

function toggleSearchMode() {
    isAISearch = !isAISearch;
    searchToggle.classList.toggle('active', isAISearch);
    
    if (searchQuery) {
        updateBookmarkDisplay(); // Re-run search with new mode
    }
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

function sendAIMessage() {
    const aiInput = document.getElementById('ai-input');
    const aiChat = document.getElementById('ai-chat');
    
    if (!aiInput || !aiChat) return;
    const message = aiInput.value.trim();
    
    if (!message) return;
    
    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-message';
    userMessage.innerHTML = `<div class="message user-message">${message}</div>`;
    aiChat.appendChild(userMessage);
    
    aiInput.value = '';
    
    // Simulate AI response
    setTimeout(() => {
        const responses = [
            "I found 5 React development bookmarks in your collection. Would you like me to show them?",
            "Based on your search, here are the most relevant productivity tools you've saved.",
            "I can help you organize these bookmarks into better categories. Should I suggest some improvements?",
            "You have quite a few AI and machine learning resources. Here are the top ones based on your query."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const botMessage = document.createElement('div');
        botMessage.className = 'ai-message';
        botMessage.innerHTML = `<div class="message bot-message">${randomResponse}</div>`;
        aiChat.appendChild(botMessage);
        
        aiChat.scrollTop = aiChat.scrollHeight;
    }, 1000);
    
    aiChat.scrollTop = aiChat.scrollHeight;
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
            
            // Store the bookmarks
            bookmarks = parsedBookmarks;
            categories = generateCategoriesFromBookmarks(parsedBookmarks);
            
            // Save to localStorage
            saveBookmarksToStorage();
            
            // Show success and update UI
            showUploadSuccess(parsedBookmarks.length);
            
            setTimeout(() => {
                hideUploadModal();
                renderCategoryTree();
                updateBookmarkDisplay();
            }, 2000);
            
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

function showUploadSuccess(count) {
    const uploadArea = document.getElementById('upload-area');
    uploadArea.innerHTML = `
        <div class="upload-icon">✅</div>
        <div class="upload-text">Success!</div>
        <div class="upload-subtext">Processed ${count} bookmarks</div>
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
        <button class="upload-button" onclick="document.getElementById('file-input').click()">
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
            document.getElementById('file-input').click();
        });
    }
});

// Settings Tab Management
function switchSettingsTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
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
