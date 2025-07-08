
UI improvement:
Add word(phrase) to wordlist


frontend:
How to add phrases to list?

1) We already can add phrase from text to word list, need to add some details to API call
    Example phrase: Pick a phrase from the text - easy

1.1) Add phrases from MessageInput:
    Keep this feature in mind, but don't implement it now, 
    AS we have no  Example phrase here it will require to search for good example from database or generate with chat gpt

on the other side of the card, I should see 

    Back side: translation of the word, the translation of the example sentence 
    Front side: word, an example sentence in spanish A2 level(that we get when added word)

3) export to md, just copy word list into md format with some js(easy)


Backend:
1) add a word to the list API(post):
   1) need to add:
   - example sentence search
   - example sentence generation via chatgpt if not found in DB(generate with translation), save for later use in table sentences(see src/backend/services/sentence/db_models.py, use "ChatGpt" for entry in reverse_index_texts table )
   - translate phrase to english(with chat gpt we get translation when generate, so skip the step)
    For google only: we might miss the word meaning when translate separatly, better is formating text before sending to transalte API(google)  like <word> word </word><translate> translate </translate> 
1) Card word display:
   1) add extra information: phrase example, phrase translation, example translation to API response(GET)
   ```

    class WordInList:
        word: str
        word_translation: str
        example_phrase: str
        example_phrase_translation: str
        

    class Wordlist(SQLModel, table=True):
        """Model for word lists."""
        id: int | None = Field(default=None, primary_key=True)
        name: str = Field()
        words: list[WordInList] = Field(default_factory=list, sa_column=Column(JSON))
        language: str = Field(default="en")  # Default to English if not specified

    ```


Future improvements:
    - finally use gpt 4 mini to detect the form, but we will keep it off, so we don't do extra call and save money, we need it for spanish only btw, and part of speach, use gpt 4 mini or find custom model
    - gender, if noun, verb form like S3 for single third, P3-for plural third add in future

