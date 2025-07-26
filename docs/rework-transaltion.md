Rework of translate feature in MessageInput

This feature allows me translate a phrase just after I highlighted it

I have messageInput component, with SelectionToolbar where the system puts transalted text
But it doesnot work well for big text, because SelectionToolbar is small and it doesnt feet all text
I want to
1) Translate one line at a time when selected - it's implemented
2) Translate multiple lines: old behavior put in the SelectionToolbar,  new behavior - put multiple lines transaltion into Text Editors text area
   - I need that every pair of (line, line_translated) replaces correspodning line position in text editor, format it like line - line_translated 
   - Keep in mind that I use custom scroll Effect, and you need update cursor position after text in text area is changed(see useScrollBehavior)


Update: useScrollBehavior brakes UI adding scrolling jumps, don't use it


---
───────────────────────────────────────────────────────────────────╮
│ > can you add and improvement? don't use \- for delimeter, use ::   │
│   and if I change something by left side of :: and highlight it,    │
│   and if I have transaltion by right side, it should transalte      │
│   only part left to :: like I have frined :: У меня есть друг, I    │
│   changed to I have frined and cat, right part should change, not   │
│   a whole string  

---

 I think I want to invoke multiline transaltion by key             │
│   combination like ctrl+shift+ T, one line should happen when I stopped    │
│   highlighting(like now)      
---

│ > I have problem  with text area after copy pasting the text,       │
│   multiline scroll breaks, I want to add logs to critical spots of  │
│   useCaretTracking and updateCaretAndScroll, so I could trace the   │
│   problem    