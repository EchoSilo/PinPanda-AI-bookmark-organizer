# Bookmark Organizer

A modern web application that helps you organize your browser bookmarks using AI. Built with Next.js, TypeScript, Chakra UI, and TailwindCSS.

## Features

- Upload HTML bookmark files exported from any major browser
- Automatically organize bookmarks into logical categories using AI
- Identify duplicate bookmarks
- Drag and drop interface for manual reorganization
- Export organized bookmarks back to HTML format
- Responsive design that works on desktop and mobile

## Tech Stack

- **Next.js**: React framework for server-rendered applications
- **TypeScript**: Type-safe JavaScript
- **Chakra UI**: Component library for building accessible UI
- **TailwindCSS**: Utility-first CSS framework
- **OpenAI API**: AI-powered bookmark categorization

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/bookmark-organizer.git
cd bookmark-organizer
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
```
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Export your bookmarks from your browser:
   - **Chrome**: Bookmarks → Bookmark Manager → ⋮ → Export bookmarks
   - **Firefox**: Bookmarks → Show All Bookmarks → Import and Backup → Export Bookmarks to HTML
   - **Safari**: File → Export Bookmarks
   - **Edge**: Favorites → ⋮ → Export favorites

2. Upload the HTML file to the Bookmark Organizer

3. Wait for the AI to process and categorize your bookmarks

4. Review and reorganize the categories if needed

5. Export the organized bookmarks back to an HTML file

6. Import the organized bookmarks back into your browser

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the AI capabilities
- The Next.js, Chakra UI, and TailwindCSS teams for their excellent tools
