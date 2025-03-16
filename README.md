# 🐼 PinPanda - Smart Bookmark Organizer

PinPanda is a delightful web application that helps you tame the chaos of your browser bookmarks using AI. Say goodbye to disorganized bookmark folders and hello to a beautifully organized collection!

<div align="center">
  <img src="public/PinPanda-logo.png" alt="PinPanda Logo" width="120" height="120">
  <br>
  <em>Organize your bookmarks intelligently with PinPanda's AI-powered categorization</em>
</div>

## ✨ What PinPanda Does

PinPanda transforms your messy bookmark collection into neatly organized categories with just a few clicks:

- **Smart Categorization**: Upload your bookmarks and watch PinPanda intelligently sort them
- **Duplicate Detection**: Identify and manage duplicate bookmarks
- **Intuitive Interface**: Drag and drop bookmarks between categories with ease
- **Cross-Browser Support**: Works with bookmarks from Chrome, Firefox, Safari, Edge, and more
- **Export Ready**: Get your organized bookmarks back in standard HTML format

## 🚀 Getting Started

### Try PinPanda Online

Visit our hosted version at [pinpanda.app](https://pinpanda.app) to try PinPanda without any installation.

### Run Locally

#### Prerequisites

- Node.js 18.x or later
- npm or yarn
- OpenAI API key

#### Installation

1. Clone the repository
```bash
git clone https://github.com/EchoSilo/PinPanda-AI-bookmark-organizer.git
cd PinPanda-AI-bookmark-organizer
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

## 📚 How to Use PinPanda

1. **Export your bookmarks** from your browser:
   - **Chrome**: Bookmarks → Bookmark Manager → ⋮ → Export bookmarks
   - **Firefox**: Bookmarks → Show All Bookmarks → Import and Backup → Export Bookmarks to HTML
   - **Safari**: File → Export Bookmarks
   - **Edge**: Favorites → ⋮ → Export favorites

2. **Upload** the HTML file to PinPanda

3. **Watch the magic happen** as PinPanda processes and categorizes your bookmarks

4. **Fine-tune** your bookmark collection by dragging items between categories

5. **Export** your organized bookmarks back to an HTML file

6. **Import** the organized bookmarks back into your browser

## 🛠️ Tech Stack

PinPanda is built with modern web technologies:

- **Next.js** - React framework for server-rendered applications
- **TypeScript** - Type-safe JavaScript
- **Chakra UI** - Component library for beautiful, accessible UI
- **TailwindCSS** - Utility-first CSS framework
- **OpenAI API** - AI-powered bookmark categorization

## 🤝 Contributing

We welcome contributions to PinPanda! Feel free to open issues or submit pull requests to help make PinPanda even better.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for providing the AI capabilities
- The Next.js, Chakra UI, and TailwindCSS teams for their excellent tools
- All our users who provide valuable feedback

---

<div align="center">
  <p>Made with ❤️ by the PinPanda team</p>
</div>
