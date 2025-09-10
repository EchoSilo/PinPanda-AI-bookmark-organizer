# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PinPanda is an AI-powered bookmark organizer that helps users intelligently categorize browser bookmarks. The application is built as a static frontend with an optional FastAPI backend for AI processing.

## Architecture

**Frontend (Static):**
- `index.html` - Main application interface with modals and UI components
- `script.js` - Core JavaScript functionality for bookmark management, UI interactions, and AI integration
- `styles.css` - Application styling
- Static files served via Python HTTP server on port 5000

**Backend (Optional FastAPI):**
- `backend/main.py` - FastAPI server for AI processing endpoints
- Runs on port 8000 when started
- Handles bookmark categorization via OpenAI API

**Key Data Flow:**
- Bookmarks stored in browser localStorage (`pinpanda_bookmarks`, `pinpanda_categories`)
- AI categorization can work client-side (direct OpenAI API calls) or via backend
- HTML bookmark files imported/exported for browser compatibility

## Development Commands

**Frontend Development:**
```bash
# Start development server (Python HTTP server on port 5000)
npm run dev
# or
python3 -m http.server 5000

# Alternative start command
npm start
```

**Backend Development (Optional):**
```bash
# Start FastAPI backend server
python3 start_backend.py
# Server runs on http://localhost:8000
# API docs at http://localhost:8000/docs

# Manual backend start
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Dependencies:**
```bash
# Backend dependencies (if using FastAPI backend)
pip install -r requirements.txt
```

## Key Components

**JavaScript Architecture (`script.js`):**
- Bookmark data management and localStorage persistence
- HTML bookmark file parsing and export functionality
- AI integration for categorization (both client-side and backend modes)
- Drag-and-drop UI interactions
- Modal management for upload, settings, export
- Search and filtering functionality

**Main UI Components (`index.html`):**
- Header with AI connection status, search, and action buttons
- Sidebar with category tree navigation
- Main content area with grid/list bookmark views
- AI assistant panel for bookmark queries
- Multiple modals: upload, settings, export, reorganize

**Backend API (`backend/main.py`):**
- `/categorize` - AI-powered bookmark categorization
- `/chat` - AI assistant for bookmark queries
- `/health` - Health check endpoint
- CORS enabled for frontend integration

## Configuration

**AI Settings:**
- OpenAI API key stored in localStorage
- Configurable AI models (GPT-4, GPT-3.5-turbo, etc.)
- Categorization depth settings (simple, balanced, detailed)

**Browser Compatibility:**
- Supports bookmark imports from Chrome, Firefox, Safari, Edge
- Exports to standard HTML bookmark format