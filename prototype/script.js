// Extended Mock Data with dates
function generateBookmarkDate() {
    const start = new Date(2023, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
        return null;
    }
}

// Mock Data
const mockCategories = {
    "Web Development": {
        children: {
            "React": { bookmarks: 15 },
            "Vue.js": { bookmarks: 8 },
            "Angular": { bookmarks: 6 },
            "JavaScript": { bookmarks: 23 },
            "CSS Frameworks": { bookmarks: 12 },
            "Backend": {
                children: {
                    "Node.js": { bookmarks: 18 },
                    "Python": { bookmarks: 14 },
                    "API Design": { bookmarks: 9 }
                }
            }
        }
    },
    "Design": {
        children: {
            "UI/UX": { bookmarks: 22 },
            "Color Palettes": { bookmarks: 7 },
            "Typography": { bookmarks: 11 },
            "Design Systems": { bookmarks: 16 },
            "Tools": {
                children: {
                    "Figma": { bookmarks: 13 },
                    "Sketch": { bookmarks: 5 },
                    "Adobe": { bookmarks: 8 }
                }
            }
        }
    },
    "Productivity": {
        children: {
            "Task Management": { bookmarks: 9 },
            "Note Taking": { bookmarks: 12 },
            "Time Tracking": { bookmarks: 6 },
            "Automation": { bookmarks: 14 }
        }
    },
    "AI & Machine Learning": {
        children: {
            "ChatGPT Resources": { bookmarks: 19 },
            "Machine Learning": { bookmarks: 24 },
            "AI Tools": { bookmarks: 31 },
            "Data Science": { bookmarks: 17 }
        }
    },
    "News & Blogs": {
        children: {
            "Tech News": { bookmarks: 28 },
            "Industry Blogs": { bookmarks: 15 },
            "Newsletters": { bookmarks: 11 }
        }
    }
};

const mockBookmarks = [
    {
        title: "React Documentation",
        url: "https://react.dev",
        description: "The official React documentation with guides, API reference, and tutorials for building user interfaces.",
        category: "Web Development / React",
        dateAdded: new Date('2023-11-15'),
        favicon: getFaviconUrl('https://react.dev')
    },
    {
        title: "Figma - Collaborative Interface Design",
        url: "https://figma.com",
        description: "A collaborative interface design tool that helps teams create, prototype, and gather feedback.",
        category: "Design / Tools / Figma",
        dateAdded: new Date('2023-10-22'),
        favicon: getFaviconUrl('https://figma.com')
    },
    {
        title: "ChatGPT by OpenAI",
        url: "https://chat.openai.com",
        description: "AI-powered conversational assistant for answering questions, writing, and creative tasks.",
        category: "AI & Machine Learning / ChatGPT Resources",
        dateAdded: new Date('2023-12-01'),
        favicon: getFaviconUrl('https://chat.openai.com')
    },
    {
        title: "GitHub - Code Collaboration",
        url: "https://github.com",
        description: "Platform for version control, code collaboration, and project management for developers.",
        category: "Web Development / JavaScript",
        dateAdded: new Date('2023-09-15'),
        favicon: getFaviconUrl('https://github.com')
    },
    {
        title: "Notion - All-in-one Workspace",
        url: "https://notion.so",
        description: "Versatile workspace for notes, tasks, databases, and team collaboration.",
        category: "Productivity / Note Taking",
        dateAdded: new Date('2023-11-08'),
        favicon: getFaviconUrl('https://notion.so')
    },
    {
        title: "TechCrunch",
        url: "https://techcrunch.com",
        description: "Leading technology news website covering startups, gadgets, and tech industry trends.",
        category: "News & Blogs / Tech News",
        dateAdded: new Date('2023-10-12'),
        favicon: getFaviconUrl('https://techcrunch.com')
    },
    {
        title: "Tailwind CSS",
        url: "https://tailwindcss.com",
        description: "Utility-first CSS framework for rapidly building custom user interfaces.",
        category: "Web Development / CSS Frameworks",
        dateAdded: new Date('2023-11-20'),
        favicon: getFaviconUrl('https://tailwindcss.com')
    },
    {
        title: "Dribbble - Design Inspiration",
        url: "https://dribbble.com",
        description: "Community of designers sharing screenshots of their work, process, and projects.",
        category: "Design / UI/UX",
        dateAdded: new Date('2023-10-05'),
        favicon: getFaviconUrl('https://dribbble.com')
    },
    {
        title: "Jupyter Notebooks",
        url: "https://jupyter.org",
        description: "Web-based interactive development environment for data science and machine learning.",
        category: "AI & Machine Learning / Data Science",
        dateAdded: new Date('2023-09-28'),
        favicon: getFaviconUrl('https://jupyter.org')
    },
    {
        title: "Zapier - Automation Platform",
        url: "https://zapier.com",
        description: "Automation platform that connects your apps and automates workflows.",
        category: "Productivity / Automation",
        dateAdded: new Date('2023-11-12'),
        favicon: getFaviconUrl('https://zapier.com')
    },
    {
        title: "Vue.js Documentation",
        url: "https://vuejs.org",
        description: "Progressive JavaScript framework for building user interfaces and single-page applications.",
        category: "Web Development / Vue.js",
        dateAdded: new Date('2023-10-18'),
        favicon: getFaviconUrl('https://vuejs.org')
    },
    {
        title: "Material Design",
        url: "https://material.io",
        description: "Google's design system with guidelines, components, and tools for digital products.",
        category: "Design / Design Systems",
        dateAdded: new Date('2023-11-02'),
        favicon: getFaviconUrl('https://material.io')
    }
];

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
    renderCategoryTree();
    renderBookmarks(mockBookmarks);
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    searchToggle.addEventListener('click', toggleSearchMode);
    
    // AI input handling
    const aiInput = document.getElementById('ai-input');
    aiInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendAIMessage();
        }
    });
}

// Render Category Tree
function renderCategoryTree() {
    categoryTree.innerHTML = '';
    
    // Add "All Bookmarks" option
    const allItem = createCategoryItem('All Bookmarks', mockBookmarks.length, '', true);
    categoryTree.appendChild(allItem);
    
    // Render categories
    Object.entries(mockCategories).forEach(([name, data]) => {
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
        renderBookmarks(mockBookmarks);
    } else {
        contextTitle.textContent = path;
        const filteredBookmarks = mockBookmarks.filter(bookmark => 
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
            renderBookmarks(mockBookmarks);
        } else {
            const filteredBookmarks = mockBookmarks.filter(bookmark => 
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
    let filteredBookmarks = mockBookmarks.filter(bookmark => {
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
        handleSearch(); // Re-run search with new mode
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
    handleSearch();
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

function hideUploadModal() {
    document.getElementById('upload-modal').style.display = 'none';
}

function closeAllPanels() {
    closeAIPanel();
}

// Responsive handling
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        const backdrop = document.getElementById('backdrop');
        backdrop.classList.remove('show');
    }
});

// Close modals when clicking outside
window.addEventListener('click', function(e) {
    const exportModal = document.getElementById('export-modal');
    const uploadModal = document.getElementById('upload-modal');
    
    if (e.target === exportModal) {
        hideExportModal();
    }
    
    if (e.target === uploadModal) {
        hideUploadModal();
    }
});