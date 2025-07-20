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