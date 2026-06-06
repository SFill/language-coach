## Agentic UI Development Workflow

This project supports an agentic UI development loop where a coding agent (non-vision model) implements UI changes and verifies them automatically using Playwright MCP. Vision model comparison is optional.

## List of don'ts:
- dont read image directly as you dont dupport image recognition
Read 1 file (ctrl+o to expand)
  ⎿  API Error: 400 this model does not support image input (ref: c18d58d5-7a20-4ce9-9e8a-d1770bdcb9fb)
- for image feedback use scripts

### Architecture

```
Agent (implement) → code changes → Playwright MCP (verify) → agent iterates
                                                       ↘ (optional) vision model (judge) → structured feedback → agent iterates
```

### Tools

| Tool                                       | Purpose                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Playwright MCP**                         | Interactive browser control — navigate, screenshot, evaluate JS, check console, get accessibility tree                                                                                     |
| **Playwright tests**                       | Automated regression — `visual.spec.ts`, `layout.spec.ts`, `accessibility.spec.ts`, `console.spec.ts`                                                                                      |
| **`scripts/judge.py`**                     | *(Optional)* Vision model comparison — sends target + implementation screenshots to vision model, returns `{ match, feedback, diff_areas }`                                                |
| **`scripts/explain_screenshot.py`**        | *(Optional)* Vision model description of a single screenshot — modes: `brief`, `detailed`; `--focus <aspect>` to emphasize a specific detail (e.g. `cards`, `spacing`, `text readability`) |
| **`scripts/prepare_stitch_screenshot.py`** | Download Stitch screen HTML and serve locally for high-res Playwright rendering                                                                                                            |
| **`/stitch-screenshot` skill**             | Full workflow: fetch Stitch HTML → serve → navigate → check errors → screenshot                                                                                                            |

### MCP Verification Workflow

When take screenshots you MUST save them to `tests/screenshots/`

When using Playwright MCP to verify UI changes:

1. **Set viewport** — `browser_resize` to 1920×1280
2. **Navigate** — `browser_navigate` to the route
3. **Screenshot** — `browser_take_screenshot` saves to `tests/screenshots/` - (optional) only if visial model is involved as judge
4. **Layout check** — `browser_evaluate` for overflow, element visibility:
   ```js
   () => {
     const doc = document.documentElement;
     return { overflow: doc.scrollWidth > doc.clientWidth, viewport: { width: window.innerWidth, height: window.innerHeight } };
   }
   ```
5. **Console errors** — `browser_console_messages({ level: "error" })`, filter backend-connection errors
6. **Accessibility** — Inject axe-core via `browser_evaluate`, then run `window.axe.run()`
7. **Judge comparison** (optional) — `python scripts/judge.py --target <target.png> --impl <current.png>`

### App Routes

| Path            | Component        | Notes              |
| --------------- | ---------------- | ------------------ |
| `/`             | `NoteWindowPage` | Home — note editor |
| `/note/:noteId` | `NoteWindowPage` | Individual note    |
| `/notelist`     | `NoteListPage`   | Saved notes list   |
| `/wordlist`     | `WordListPage`   | Word collections   |
| `/homework`     | `HomeworkLab`    | Writing exercises  |

### Key Config

- **Vite dev server**: port 5173 (no proxy, frontend calls backend at `localhost:8000`)
- **Playwright**: 1920×1280 viewport, chromium only, `toHaveScreenshot` with 2% diff tolerance
- **MCP**: `.mcp.json` with `@playwright/mcp@latest --browser chromium --caps vision,devtools,network`

### NPM Scripts

```bash
npm run test:visual    # Visual regression (screenshot comparison)
npm run test:layout    # Overflow, element visibility, viewport
npm run test:a11y      # axe-core accessibility violations
npm run test:console   # Console error detection (filtered)
npm run test:all       # All Playwright tests
npm run judge          # python scripts/judge.py
npm run iterate        # ./scripts/iterate.sh
```

### Files

```
tests/
├── visual.spec.ts          # Screenshot regression (3 routes)
├── layout.spec.ts          # Overflow, navbar, main content, viewport
├── accessibility.spec.ts   # axe-core violations, headings, alt text
├── console.spec.ts         # Console error detection
├── targets/
│   └── home.json           # Text description of target UI state
├── snapshots/              # Baseline screenshots (git-tracked)
├── screenshots/             # Current-state screenshots (gitignored)
└── reports/                 # Judge + iterate output (gitignored)

scripts/
├── judge.py                     # Vision model comparison (OpenAI-compatible endpoint)
├── explain_screenshot.py        # Describe a screenshot via vision model (brief/detailed)
├── prepare_stitch_screenshot.py # Download Stitch HTML, serve locally for Playwright
└── iterate.sh                   # Edit → build → test → report loop
```

## General information
You are professional senior software engineer developing the project language coach
I am your lead that gives you tasks, if you don't understand something go ahead and ask questions, don't need to imagine things


## Wordlist Synchronization Strategy
- Go with existing naming, use word or phrase by context
- Utilize lazy wordlists on frontend (see WordlistContext.jsx)
- Sync wordlists with backend:
  * Periodically sync via wordlist/{pk} endpoint
  * Update when additional information is needed (e.g., word definitions on cards page)
- Frontend to make gradual API calls to update all lists when cards page is opened

## Development Principles
- Don't keep anything for backward compatibility like API formats, do clean feature implementing
- Don't fallback to old definition, never fallback
- Sometimes you fall into over engineering with UI components:
  1) if you want to make component more robust, don't do that
  2) don't introduce site behaviors in code
  3) If you investigate the bug, prompt you guess first so I could agree or disagree
  4) don't use useEffect like it magic, use only of you are certain it doesnot introduce bugs
- Don't use try except in tests unless test fails by design like validation failed test
- don't mind pyenv because I saw many time you want to handle pyenv
- don't run test unless I specified, update tests if at place

# Project structure

src/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── note.py             # Note endpoints
│   │   ├── dictionary.py       # Dictionary lookup endpoints
│   │   ├── sentence.py         # Example sentence retrieval endpoints
│   │   ├── translation.py      # Translation endpoints
│   │   └── wordlist.py         # Wordlist management endpoints
│   ├── downloader/             # Gutenberg books downloader module
│   │   ├── __init__.py
│   │   ├── db_integration.py   # Import books to database
│   │   ├── gutenberg_downloader.py # Downloads books from Gutenberg
│   │   └── requirements.txt    # Downloader dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   ├── note.py             # Note data models
│   │   ├── dict_english.py     # English dictionary models
│   │   ├── dict_spanish.py     # Spanish dictionary models
│   │   └── wordlist.py         # Wordlist data models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── note_service.py     # Note service with GPT integration
│   │   ├── dict_spanish_service.py  # Spanish dictionary service
│   │   ├── dictionary_service.py    # English dictionary service
│   │   ├── sentence/           # Sentence retrieval services
│   │   │   ├── __init__.py
│   │   │   ├── db_models.py    # Database models for corpus
│   │   │   ├── gdex.py         # Good Dictionary Examples scoring
│   │   │   ├── sentence_retriever.py # Sentence search and retrieval
│   │   │   └── sentence_service.py   # Service layer for sentence retrieval
│   │   ├── translation_service.py    # Translation service
│   │   └── unified_dictionary_service.py  # Combined dictionary interface
│   ├── __init__.py
│   ├── constants.py            # System prompts and constants
│   ├── database.py             # Database connection setup
│   └── main.py                 # FastAPI main application
├── frontend/
│   ├── assets/
│   │   └── react.svg
│   ├── notewindow/             # Note interface components
│   │   ├── components/         # Reusable note components
│   │   ├── NoteBlock.jsx    # Note message component
│   │   ├── NoteToolbar.jsx     # Selection toolbar component
│   │   ├── NoteWindow.jsx      # Main note window component
│   │   └── NoteWindowPage.jsx  # Note page container
│   ├── MessageInput/           # Advanced text input component
│   │   ├── hooks/              # Custom hooks for input behavior
│   │   ├── index.jsx           # Main component export
│   │   ├── SelectionToolbar.jsx # Text selection toolbar
│   │   └── TextEditor.jsx      # Core text editor component
│   ├── wordlist/               # Wordlist management components
│   │   ├── ReverseContext.jsx     # Word context examples
│   │   ├── ReverseContext.module.css  # Modular CSS for context examples
│   │   ├── WordListPage.jsx    # Wordlist page container
│   │   ├── WordLists.jsx       # List of word collections
│   │   ├── WordlistContext.jsx # State management for wordlists
│   │   └── utils.js            # Wordlist helper functions
│   ├── hooks/                  # App-wide custom hooks
│   ├── App.jsx                 # Main React app component
│   ├── api.js                  # API client functions
│   ├── main.jsx                # React entry point
│   └── SideDictionaryPanel.jsx # Dictionary lookup panel
├── docker-compose.yml          # Docker setup for deployment
├── requirements.txt            # Python dependencies
└── README.md