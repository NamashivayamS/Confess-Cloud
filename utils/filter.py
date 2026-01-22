import re
from utils.bad_words import BAD_WORDS

def is_clean(text: str) -> bool:
    cleaned = re.sub(r'[^a-zA-Z]', '', text.lower())
    for word in BAD_WORDS:
        if word in cleaned:
            return False
    return True
