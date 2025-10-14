# Frontend Technical Assignment — Q/A Tiles under a Note (Chatbot Assistant)

## 1) Summary

Enhance or current chat note taking workflow by building a UI where a user writes a **Note**, asks the chatbot **Questions** about that note, and sees each asked question appear as a **Tile** underneath the note. Each tile loads, then shows a **title**; clicking the title **expands/collapses** the tile to reveal the full content (the question and the assistant’s answer).

## 2) Scope


* Remove <ExpandableContent isLong={isLong}> component as we gonna replace it with new tile system
* One page(@src/frontend/chatwindow/ChatWindowPage.jsx):

  * Message component @src/frontend/chatwindow/ChatMessage.jsx
  * An input row (simple text field + Ask button) to submit a question about the current note, in the block of buttons of @src/frontend/chatwindow/ChatMessage.jsx
  * A list of **Question Tiles** rendered below the note(create a new component @src/frontend/chatwindow/ChatTile.jsx)
* Behavior for creating tiles, loading, success, error, expand/collapse
* Make those ChatMessage buttons as **sticky action buttons** (when scrolling, the buttons stick in view and relate to the current note)
* Mock API integration (specify DTOs for data to display). Calls will be mocked locally for now. use @src/frontend/api.js to store mocks

## 3) Definitions & Entities

* **Note**: A message that has is_note flag as true, assume flag is added on backend, need to drill it on FE.
* **Question**: A prompt entered by the user about the note.
* **Tile**: A visual card representing one question and answer. Has states: `loading`, `ready`, `error`. Has `expanded`/`collapsed` view modes.
* **Group of Question**: Question as tiles are grouped bellow note which they relate to
* **Question note relation**: Question relates to note which it follows in messages list
* questions and notes are messages in the context of ChatWindow so you will work with flat list

## 4) User Stories

1. As a user, I can type a question in a simple text field and click **Ask**.
2. When I click **Ask**, I immediately see a **loading tile** appear below the note.
3. When the response resolves, the tile shows a **title** (derived from the question) and becomes **clickable** to expand/collapse full content.
4. I can collapse the tile by clicking a **Hide** button near the title or clicking the title area.
5. If the API fails, the tile shows an **error state** with a retry action.
6. When I scroll, the **action buttons row** remains **sticky** and always associated with the note.


## 7) Tile States & Behaviors

* **States**

  * `loading`: shows skeleton(loading text) / spinner
  * `ready`: shows **title** row; clicking title toggles **expanded**
  * `error`: shows error icon/message and **Retry** button
* **Expanded Content** (ready state)

  * Title row: "Q: <title>" + actions (Hide)
  * Body: full question, assistant answer (markdown supported), timestamps
* **Collapsed**

  * Only the title row is visible
* **Hide** button

  * Collapses the tile (does not remove)


## 9) Visual & Interaction Guidelines

* **Sizing**: Tiles use full width of content column; 16px–24px padding inside.
* **Elevation**: subtle shadow + 8–12px radius.
* **Hover**: title row hover indicates clickability.
* **Sticky Row**: CSS `position: sticky; top: <headerHeight>`; full-bleed background.



### 10.2 Display DTOs (frontend view models), notation in TS, but use this structure for display logic

```ts
export interface TileDisplay {
  id: ID;               // same as message id
  title: string;        // shown in collapsed view, original question
  content: string;     // full question answer
  state: 'loading' | 'ready' | 'error';
  expanded: boolean;    // UI-only
  createdAt: string;    // for ordering and timestamp label
  error?: { code: string; message: string; retriable: boolean };
}
```

### 10.3 Mock Endpoints (local-only)


* **POST** `/api/coach/chat/{id}/message` — create a new question for the note

  * **Request**

    ```json
    {
      "message": "Why did revenue drop in Feb?",
      "is_note": false,
      "image_ids": [
        0
      ]
    }
    
    ```
  * **Response** 

    ```json
    {
      "id": 2,
      "role": "bot",
      "question": "Why did revenue drop in Feb?", // is for TileDisplay.title
      "content": "the content", // is for TileDisplay.content,
      "created_at": "2025-10-08T14:39:46.977341",
      "updated_at": "2025-10-08T14:39:46.977341",
      "is_note": false,
      
    }
    ```

> For local mocking: implement responses with a 1–3s random delay; 15% chance of error.


## 11) Client Logic (State Machine)

**On Ask:**

1. Validate non-empty input.
2. Create an optimistic `TileDisplay` with state=`loading`; prepend to list.
3. `POST /api/coach/chat/{id}/message` → receives `message.id`.
4. On `ok`: update tile → state=`ready`, set title and content, set `expanded=true`.
5. On `error`: update tile → state=`error`, `expanded=true`.


**On Title Click or Hide Button:**

* Toggle `expanded` (Hide sets `expanded=false`).



## 16) QA Acceptance Criteria

* [ ] When I type a question and press **Ask** or hit **Enter**, a **loading tile** appears immediately below the note.
* [ ] After mock delay, tile becomes **ready** with a **title**. Clicking the title toggles expand/collapse.
* [ ] A **Hide** button next to the title collapses the tile.
* [ ] On simulated API error, tile shows **error state**
* [ ] The **action buttons row** stays **sticky** while scrolling.
* [ ] New tiles appear at the **top** of the list.


## 18) Future Considerations

* Drag-and-drop reordering (keyboard accessible)

