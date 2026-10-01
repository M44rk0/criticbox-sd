import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.services import storage as database
from criticbox_sd.services import tmdb as tmdb_service


def backfill():
    database.init_db()
    reviews = database.get_all_reviews(limit=1000)
    print(f"Total reviews no banco: {len(reviews)}")
    updated = 0
    for r in reviews:
        poster = r.get("poster_url") or ""
        if not poster:
            mid = r["tmdb_id"]
            mtype = r.get("media_type") or "movie"
            title = r.get("movie_title") or f"ID {mid}"
            try:
                details = tmdb_service.get_movie_details(mid, media_type=mtype)
                if details and details.get("poster_url"):
                    p_url = details["poster_url"]
                    database.update_review_poster(r["review_id"], p_url)
                    print(f"[OK] Atualizado: {title} -> {p_url}")
                    updated += 1
                else:
                    print(f"[-] Sem poster encontrado para {title} (ID {mid})")
            except Exception as e:
                print(f"[!] Erro ao buscar poster para {title}: {e}")
    print(f"Concluido! {updated} reviews atualizadas com poster_url.")


if __name__ == "__main__":
    backfill()
