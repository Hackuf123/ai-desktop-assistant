## Quick Start Guide - AI Desktop Assistant

### 1️⃣ Setup (2 minutes)

```bash
# Copy the .env.example to .env
cp .env.example .env

# Edit .env and paste your OpenAI API key:
# OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2️⃣ Install Dependencies (if not done)

```bash
npm install
```

### 3️⃣ Start the Application

```bash
npm start
```

You should see:
- Electron window opens
- Console log: `OPENAI_API_KEY: set` ✅ (if key is in .env)
- Console log: `OPENAI_API_KEY: missing` ❌ (if .env not set)

---

## 🧪 Test Commands

### Text Input Mode
In the app, click **Run** button after typing:

#### YouTube Search
```
open youtube ai tutorials
```
→ Opens YouTube with search results in your browser

#### Weather Report
```
open weather London
```
→ Opens wttr.in weather page + shows temperature data

#### News
```
open news
```
→ Opens Google News in browser

#### Launch App
```
open notepad
```
Or: `launch calculator`
→ Launches the app on your system

#### Text Analysis
```
summarize this is a sample text with multiple sentences about AI and automation
```
→ Summarizes using OpenAI (if key is set) or fallback basic summary

---

### 🎤 Voice Mode (Browser Support Required)

1. Click **Start Voice** button
2. Speak clearly:
   - "Open YouTube machine learning"
   - "Show weather in New York"
   - "Open news"
   - "Launch spotify"

3. Click **Stop Voice** to end

---

## 📊 Browser Console Debug

Press `F12` to open developer console and see:
- Command processing logs
- API responses
- Errors (if any)
- Voice transcripts

Example output:
```
> open youtube ai news
🎤 Heard: open youtube ai news
=> Opened YouTube search for "ai news"
```

---

## ☑️ Verification Checklist

- [ ] `npm install` completed (all 900+ packages)
- [ ] `.env` file created with `OPENAI_API_KEY=sk-...`
- [ ] `npm start` launches without errors
- [ ] Text input works (type command + click Run)
- [ ] Voice starts/stops (mic permission needed)
- [ ] Browser opens for YouTube/news/weather
- [ ] Console shows success messages

---

## 🐛 Troubleshooting

### "OPENAI_API_KEY: missing"
→ Create `.env` file with your key

### App won't start
→ Delete `node_modules/`, run `npm install` again

### Voice not working
→ Check browser supports Web Speech API (Chrome, Edge, Safari)
→ Allow microphone permission

### Weather/News shows blank
→ Check internet connection
→ Verify OpenAI key works for other tests first

---

## 📁 Project Structure

```
src/
├── main.js                 # Electron entry point (loads .env)
├── index.html             # Voice UI + web speech integration
├── modules/               # Core functionality
│   ├── voice-controller.js  # Command parsing & routing
│   ├── text-processor.js    # AI features (summary, rewrite, etc)
│   ├── data-analyzer.js     # Statistics & analysis
│   ├── email-handler.js     # Email sending
│   ├── task-scheduler.js    # Cron tasks
│   └── package-manager.js   # npm/pip/brew installation
└── skills/                # Advanced automation
    ├── file-organizer.js    # File organization
    ├── app-automator.js     # App launch/control
    ├── text-processor.js    # Text AI
    └── web-automator.js     # Web search/scrape

.env                       # Your API keys (git-ignored)
.env.example              # Template for .env
package.json              # Dependencies
README.md                 # Full documentation
AGENT_PLAN.md            # Architecture & roadmap
```

---

## 🚀 Next Steps

After verifying everything works:

1. **Enhance NLP**: Add more natural language patterns
2. **Add more skills**: PDF processing, database queries, etc.
3. **UI improvements**: Sidebar for favorites, settings panel
4. **Mobile sync**: Cross-device voice commands
5. **Custom voice**: Train custom voice model

---

## 💡 Example Voice Commands

```
"Open YouTube and search for React tutorials"
"Show me the weather in Tokyo"
"What's the latest news today?"
"Launch Visual Studio Code"
"Install axios using npm"
"Summarize the following text: [paste text]"
"Format this as HTML"
"Translate to Spanish: hello world"
```

All commands are logged in the browser console for debugging.
