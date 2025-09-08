# PinPanda - Smart Bookmark Organizer

## Overview

PinPanda is an AI-powered web application that transforms chaotic browser bookmark collections into intelligently categorized, searchable libraries. The application leverages OpenAI's GPT models to automatically organize bookmarks into meaningful categories, detect duplicates, and provide an intuitive management interface. Built as a Next.js application with TypeScript, it features a modern React-based frontend using Chakra UI for the component library.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 13.x with App Router architecture for modern React development
- **UI Library**: Chakra UI for consistent, accessible component design with light mode theming
- **State Management**: React hooks and local state for component-level state management
- **Drag & Drop**: React Beautiful DnD for intuitive bookmark reorganization
- **TypeScript**: Full TypeScript implementation for type safety and better developer experience

### Backend Architecture
- **API Layer**: Next.js API routes for server-side functionality (minimal backend footprint)
- **Client-Side Processing**: Most AI processing happens client-side using direct OpenAI API calls
- **File Processing**: Browser-based HTML bookmark file parsing using Cheerio for DOM manipulation
- **Data Storage**: localStorage for API keys and user preferences (no server-side database)

### AI Integration Architecture
- **AI Provider**: OpenAI GPT-4o-mini for bookmark categorization and search
- **Processing Strategy**: Chunked processing for large bookmark collections to handle API token limits
- **Fallback Handling**: Graceful degradation when AI services are unavailable
- **Timeout Management**: 2-minute timeout with progress tracking for AI operations

### Component Architecture
- **Modular Components**: Separated concerns with dedicated components for upload, processing, organization, search, and chat
- **Progress Tracking**: Real-time progress indicators for AI processing operations
- **Error Boundaries**: Comprehensive error handling with user-friendly messages
- **Responsive Design**: Mobile-first responsive layout using Chakra UI's responsive props

### Data Processing Flow
1. **Upload**: HTML bookmark file parsing and validation
2. **Preprocessing**: Duplicate detection and bookmark normalization
3. **AI Categorization**: Intelligent category generation using OpenAI
4. **Organization**: Hierarchical category structure with drag-and-drop capabilities
5. **Export**: Standard HTML bookmark format output

### Security Architecture
- **API Key Management**: Client-side storage with validation and secure transmission
- **No Server Storage**: All user data remains client-side, ensuring privacy
- **Input Validation**: Comprehensive validation for uploaded files and user inputs

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o-mini model for bookmark categorization and intelligent search
- **Authentication**: User-provided API keys stored locally for direct API access

### UI Framework
- **Chakra UI**: Complete component library with theming and accessibility features
- **Framer Motion**: Animation library integrated with Chakra UI for smooth transitions
- **React Icons**: Icon library providing consistent iconography

### Development Tools
- **TypeScript**: Type checking and enhanced development experience
- **ESLint**: Code linting with Next.js configuration
- **Sharp**: Image optimization for Next.js (favicon generation)

### Utility Libraries
- **Axios**: HTTP client for API requests with better error handling
- **Cheerio**: Server-side DOM manipulation for HTML bookmark parsing
- **UUID**: Unique identifier generation for bookmarks and sessions
- **React Beautiful DnD**: Drag and drop functionality for bookmark organization

### Deployment
- **Render**: Production deployment platform with automatic builds
- **Vercel**: Alternative deployment option with Next.js optimization

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge support for bookmark imports
- **File API**: HTML5 File API for client-side file processing
- **localStorage**: Browser storage for user preferences and API keys