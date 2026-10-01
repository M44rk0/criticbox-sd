import os

import requests
import tmdbsimple as tmdb
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("TMDB_API_KEY", "").strip()
if API_KEY.startswith("eyJ"):
    tmdb.REQUESTS_SESSION = requests.Session()
    tmdb.REQUESTS_SESSION.headers.update({"Authorization": f"Bearer {API_KEY}"})
tmdb.API_KEY = API_KEY

TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
