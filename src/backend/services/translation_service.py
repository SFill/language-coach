import re
import logging
import requests
from ..models.wordlist import TranslateTextRequest

class GoogleTranslateHelper:
    """Helper class for Google Translate API."""

    FILE_WITH_TOKEN_URL = 'https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main'
    TOKEN_REGEX = r"['\"]x-goog-api-key['\"]\s*:\s*['\"](\w{39})['\"]"
    API_URL = 'https://translate-pa.googleapis.com/v1/translateHtml'

    def _get_token(self):
        """Extract the API token from Google's JavaScript files."""
        response = requests.get(self.FILE_WITH_TOKEN_URL)

        match = re.search(self.TOKEN_REGEX, str(response.content), re.IGNORECASE)
        if match:
            api_key = match.group(1)
            logging.info('got API key from google')
        else:
            raise ValueError('No Api key in file')

        return api_key

    def translate(self, message, target, source='auto'):
        """Translate text using Google Translate API."""
        url = "https://translate-pa.googleapis.com/v1/translateHtml"
        headers = {
            "Content-Type": "application/json+protobuf",
            "X-Goog-API-Key": self._get_token(),
        }
        # Format: [[["Hello, how are you?"],"en","ru"],"wt_lib"]
        data = [[[message], source, target], "wt_lib"]

        response = requests.post(url, headers=headers, json=data)
        # Format of response: [['Привет, как дела?']]
        return response.json()[0][0]


def translate_text(request: TranslateTextRequest) -> dict:
    """Translate text using Google Translate API."""
    helper = GoogleTranslateHelper()
    return {
        'text': helper.translate(request.text, request.target)
    }