


 implement feature with attaching images to chats
1) I want attach image to chat(like extra source)
2) I want refer to images in messages
   1) internally backend parses my message, add images by 
references, and send message with  images to chatbot
   1) support dispalying images when message is rendered
1) I could see images I attached at left side of the 
chat(need
to work with layout and passing propse, check how dictionary 
@src/frontend/SideDictionaryPanel.jsx, 
@src/frontend/chatwindow/ChatWindow.jsx, 
@src/frontend/chatwindow/ChatWindowPage.jsx  feature works on 
frontend), call it chat images list
1) add paperclip to the chatInput toolbar 
@src/frontend/MessageInput/SelectionToolbar.jsx 
1) I want to past message from buffer 
2) When I drag image from image list, to chat input, it 
insert's reference to it

---
fixes

1) I could see images I attached at left side of the 
chat - please add sticky position like with sidedictionary container @language_coach/src/frontend/chatwindow/ChatWindowPage.css
2) support dispalying images when message is rendered  - newly send images render fine, uploaded images do not render when I reopen chat
3) I want to past message from buffer - doesnot work, I want it work when I focus on ChatInput
--
all fixed