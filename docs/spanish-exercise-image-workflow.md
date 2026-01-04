# Spanish Exercise Image Workflow - Technical Assignment

## Overview
Implement a workflow for doing Spanish exercises where images are displayed in the left column and linked notes are displayed in the middle column. Users should be able to navigate between images and their corresponding notes bidirectionally.

## Current State Analysis

### Existing Implementation
1. **Image Storage**: Images are already linked to notes via the `image_ids` array in [`NoteBlock`](../src/backend/models/note.py:15) model
2. **Left Column**: [`NoteImagesList`](../src/frontend/notewindow/NoteImagesList.jsx) component displays images in the left area
3. **Middle Column**: [`NoteWindow`](../src/frontend/notewindow/NoteWindow.jsx) displays note blocks
4. **Layout**: Three-column layout in [`NoteWindowPage`](../src/frontend/notewindow/NoteWindowPage.jsx): left (images), middle (notes), right (dictionary)
5. **Answer Tiles**: "answer to exercise" tiles are already implemented and expand/collapse on click

### Current Image Display Location
- Images are currently displayed **inline within note blocks** via `@image:X` references
- Images are also shown in the left column as thumbnails
- The left column is primarily used for upload/management

## Feature Requirements

### 1. Image Display in Left Column (Primary Implementation)

#### 1.1 Display Images Linked to Notes
**Objective**: Show only images that are linked to note blocks via the `image_ids` array

**Implementation Details**:
- Filter images in [`NoteImagesList`](../src/frontend/notewindow/NoteImagesList.jsx) to show only those referenced by note blocks
- Display images in larger thumbnail size (increase from current 50x50px to ~150-200px width)
- Maintain aspect ratio for readability
- Group images by their associated note block (optional enhancement)

**Data Flow**:
```
NoteBlock.image_ids → Filter NoteImagesList.images → Display larger thumbnails
```

#### 1.2 Click Image → Scroll to Note
**Objective**: When user clicks an image in the left column, scroll to the corresponding note block in the middle column

**Implementation Steps**:
1. Add click handler in [`NoteImagesList`](../src/frontend/notewindow/NoteImagesList.jsx) that emits image ID
2. Pass handler up to [`NoteWindowPage`](../src/frontend/notewindow/NoteWindowPage.jsx)
3. Find note block that contains the image ID in its `image_ids` array
4. Scroll to that note block using ref-based scrolling
5. Apply brief highlight animation to the target note block

**Technical Details**:
- Use `noteBlockRefs` array already present in [`NoteWindow`](../src/frontend/notewindow/NoteWindow.jsx:13)
- Add `scrollIntoView({ behavior: 'smooth', block: 'center' })` to target note block
- Add CSS animation class for highlight effect (e.g., yellow flash that fades in 1-2 seconds)
- Create new CSS class `.note-container--highlighted` in [`NoteBlock.css`](../src/frontend/notewindow/NoteBlock.css)

**Highlight Animation**:
```css
.note-container--highlighted {
  animation: highlight-flash 1.5s ease-out;
}

@keyframes highlight-flash {
  0% { background-color: transparent; }
  20% { background-color: rgba(255, 235, 59, 0.3); }
  100% { background-color: transparent; }
}
```

### 2 Fixed toolbar in collapsed mode

### 3 make images extandable

### 4. Remove Inline Image Display (Primary Implementation)

#### 4.1 Stop Rendering @image:X References
**Objective**: Remove inline image rendering from note blocks since images are now in left column

**Implementation Steps**:
1. Modify [`TranslatableContent`](../src/frontend/notewindow/components/TranslatableContent.jsx) to not render `@image:X` references as images
2. Either hide the reference text or show it as plain text (e.g., "📎 Image 123")
3. Update [`MarkdownContent`](../src/frontend/notewindow/components/MarkdownContent.jsx) if it handles image rendering

**Options**:
- **Option A**: Hide `@image:X` completely (clean view)
- **Option B**: Show as text badge "📎 Image" (maintains reference visibility)
- **Option C**: Show as clickable link that scrolls to image in left column

**Recommended**: Option B - show as text badge for reference tracking

## 5. Future Enhancement: Auto-Expand Images (Experimental - NOT for immediate implementation)

### 5.1 Scroll-Based Image Expansion
**Concept**: As user scrolls through notes, automatically expand images associated with the visible note

**Behavior**:
- When note enters viewport → expand its images in left column
- When note leaves viewport → collapse its images
- Smooth transition animations
- Only one note's images expanded at a time

**Implementation Approach** (for future reference):
- Use Intersection Observer on note blocks
- Track `expandedImageIds` state in [`NoteImagesList`](../src/frontend/notewindow/NoteImagesList.jsx)
- Apply CSS transitions for smooth expand/collapse
- Consider performance with many images

**Note**: This is marked as experimental and should NOT be implemented in the initial version. Document as future enhancement only.

## Implementation Plan

### Phase 1: Core Functionality
1. ✅ Increase image thumbnail size in left column
2. ✅ Implement click image → scroll to note with highlight
3. ✅ Implement note visibility → highlight images
4. ✅ Remove inline image rendering from notes

### Phase 2: Enhanced UX
5. ✅ Add zoom modal for full-size image viewing
6. ✅ Add keyboard navigation in zoom modal
7. ✅ Polish animations and transitions

### Phase 3: Future Enhancements (Not Immediate)
8. ⚠️ Experimental: Auto-expand images based on scroll position
9. ⚠️ Group images by note in left column
10. ⚠️ Drag-and-drop reordering of images

## Technical Considerations

### State Management
- Add `activeNoteBlockId` to [`NoteWindowPage`](../src/frontend/notewindow/NoteWindowPage.jsx) state
- Add `highlightedImageIds` to [`NoteImagesList`](../src/frontend/notewindow/NoteImagesList.jsx) state
- Add `zoomedImageId` for modal state

### Performance
- Use `React.memo` for image items to prevent unnecessary re-renders
- Debounce Intersection Observer callbacks
- Lazy load full-size images in zoom modal

### Accessibility
- Ensure keyboard navigation works for all interactions
- Add proper ARIA labels for zoom buttons and modal
- Maintain focus management when opening/closing modal

### Browser Compatibility
- Test smooth scrolling in all target browsers
- Ensure Intersection Observer has polyfill if needed
- Test CSS animations across browsers

## Files to Modify

### Frontend Components
1. [`src/frontend/notewindow/NoteWindowPage.jsx`](../src/frontend/notewindow/NoteWindowPage.jsx) - Add state and handlers for image-note linking
2. [`src/frontend/notewindow/NoteWindow.jsx`](../src/frontend/notewindow/NoteWindow.jsx) - Add Intersection Observer for visible notes
3. [`src/frontend/notewindow/NoteBlock.jsx`](../src/frontend/notewindow/NoteBlock.jsx) - Add highlight animation support
4. [`src/frontend/notewindow/NoteImagesList.jsx`](../src/frontend/notewindow/NoteImagesList.jsx) - Increase thumbnail size, add click handlers, highlight active images
5. **NEW**: `src/frontend/notewindow/components/ImageZoomModal.jsx` - Create zoom modal component
6. [`src/frontend/notewindow/components/TranslatableContent.jsx`](../src/frontend/notewindow/components/TranslatableContent.jsx) - Remove inline image rendering

### CSS Files
1. [`src/frontend/notewindow/NoteImagesList.css`](../src/frontend/notewindow/NoteImagesList.css) - Update thumbnail sizes, add active state styling, add zoom button
2. [`src/frontend/notewindow/NoteBlock.css`](../src/frontend/notewindow/NoteBlock.css) - Add highlight animation
3. **NEW**: `src/frontend/notewindow/components/ImageZoomModal.css` - Modal styling

### Backend (No Changes Required)
- API already supports image linking via `image_ids` array
- No backend modifications needed for this feature

## Testing Checklist

### Manual Testing
- [ ] Click image in left column scrolls to correct note
- [ ] Note is highlighted briefly after scroll
- [ ] Scrolling through notes highlights corresponding images
- [ ] Zoom button appears on image hover
- [ ] Zoom modal opens with full-size image
- [ ] Zoom modal closes on backdrop click, close button, and ESC key
- [ ] Arrow keys navigate between images in zoom modal
- [ ] Inline `@image:X` references are hidden or shown as badges
- [ ] Multiple images per note are handled correctly
- [ ] Notes without images don't cause errors
- [ ] Images without linked notes are handled gracefully

### Edge Cases
- [ ] Note with no images
- [ ] Image linked to multiple notes (if possible)
- [ ] Very long note list performance
- [ ] Many images in left column performance
- [ ] Rapid clicking between images
- [ ] Zoom modal with very large images

## Success Criteria

1. ✅ User can see exercise images in left column at readable size
2. ✅ User can click image to jump to corresponding note
3. ✅ User can see which images belong to current note
4. ✅ User can zoom images to full size
5. ✅ Inline image display is removed from notes
6. ✅ Smooth, intuitive navigation between images and notes
7. ✅ "Answer to exercise" tiles continue to work as before

## Notes

- This feature is designed specifically for Spanish exercise workflow
- The existing "answer to exercise" tile functionality should remain unchanged
- Images are already linked via API (`image_ids` array), no backend changes needed
- Focus on clean, intuitive UX for homework workflow
- Auto-expand feature is experimental and should be documented but not implemented initially
