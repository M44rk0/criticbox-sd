from services.tmdb.client import TMDB_IMAGE_BASE


def is_anime(m: dict) -> bool:
    """Identifica se uma obra (filme ou série) é um Anime japonês."""
    if not m:
        return False

    genre_ids = m.get("genre_ids") or []
    if not genre_ids and "genres" in m:
        genre_ids = [g.get("id") if isinstance(g, dict) else g for g in m.get("genres", [])]

    has_animation = 16 in genre_ids
    if not has_animation and "genres" in m:
        genre_names = " ".join(
            [(g.get("name", "") if isinstance(g, dict) else str(g)) for g in m.get("genres", [])]
        ).lower()
        if "animação" in genre_names or "animation" in genre_names:
            has_animation = True

    orig_lang = (m.get("original_language") or "").lower()
    origin_countries = [str(c).upper() for c in (m.get("origin_country") or [])]
    prod_countries = [
        str(c.get("iso_3166_1", "") if isinstance(c, dict) else c).upper()
        for c in (m.get("production_countries") or [])
    ]
    is_japanese = orig_lang == "ja" or "JP" in origin_countries or "JP" in prod_countries

    return bool(has_animation and is_japanese)


def _fmt(m: dict, default_media_type: str = "movie") -> dict:
    media_type = m.get("media_type") or default_media_type
    if is_anime(m):
        media_type = "anime"
    poster = m.get("poster_path")
    backdrop = m.get("backdrop_path")
    title = m.get("title") or m.get("name") or m.get("original_title") or m.get("original_name") or ""
    release_date = m.get("release_date") or m.get("first_air_date") or ""

    return {
        "id": m.get("id", 0),
        "tmdb_id": m.get("id", 0),
        "title": title,
        "release_date": release_date,
        "poster_url": f"{TMDB_IMAGE_BASE}{poster}" if poster else "",
        "backdrop_url": f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop else "",
        "overview": m.get("overview", ""),
        "tmdb_vote_average": float(m.get("vote_average", 0.0)),
        "genre_ids": m.get("genre_ids", []),
        "media_type": media_type,
    }


def _extract_certification(data: dict, is_movie: bool = True) -> str:
    if is_movie:
        releases = data.get("release_dates", {}).get("results", [])
        for r in releases:
            if r.get("iso_3166_1") == "BR":
                for rd in r.get("release_dates", []):
                    c = (rd.get("certification") or "").strip()
                    if c:
                        return c
        for r in releases:
            if r.get("iso_3166_1") == "US":
                for rd in r.get("release_dates", []):
                    c = (rd.get("certification") or "").strip()
                    if c:
                        return c
    else:
        ratings = data.get("content_ratings", {}).get("results", [])
        for r in ratings:
            if r.get("iso_3166_1") == "BR":
                c = (r.get("rating") or "").strip()
                if c:
                    return c
        for r in ratings:
            if r.get("iso_3166_1") == "US":
                c = (r.get("rating") or "").strip()
                if c:
                    return c
    return ""


def _extract_crew(crew_list: list) -> dict:
    writers = list(
        dict.fromkeys(
            [
                c.get("name", "")
                for c in crew_list
                if c.get("job") in ("Screenplay", "Writer", "Story", "Author", "Comic Book", "Characters", "Teleplay")
                and c.get("name")
            ]
        )
    )[:8]
    music_composers = list(
        dict.fromkeys(
            [
                c.get("name", "")
                for c in crew_list
                if c.get("job") in ("Original Music Composer", "Music", "Score", "Music Producer", "Composer")
                and c.get("name")
            ]
        )
    )[:6]
    cinematographers = list(
        dict.fromkeys(
            [
                c.get("name", "")
                for c in crew_list
                if c.get("job") in ("Director of Photography", "Cinematography", "Camera Operator") and c.get("name")
            ]
        )
    )[:6]
    producers = list(
        dict.fromkeys(
            [
                c.get("name", "")
                for c in crew_list
                if c.get("job") in ("Producer", "Executive Producer") and c.get("name")
            ]
        )
    )[:8]
    return {
        "writers": writers,
        "music_composers": music_composers,
        "cinematographers": cinematographers,
        "producers": producers,
    }


def _extract_watch_providers(providers_data: dict) -> dict:
    br = providers_data.get("results", {}).get("BR", {})

    def fmt(lst):
        seen = set()
        res = []
        for p in lst:
            name = (p.get("provider_name") or "").strip()
            if name and name not in seen:
                seen.add(name)
                logo = p.get("logo_path") or ""
                res.append(
                    {
                        "provider_name": name,
                        "logo_url": f"https://image.tmdb.org/t/p/w92{logo}" if logo else "",
                    }
                )
        return res

    return {
        "flatrate": fmt(br.get("flatrate", [])),
        "rent": fmt(br.get("rent", [])),
        "buy": fmt(br.get("buy", [])),
    }


def _extract_photos_and_logo(images_data: dict) -> tuple[str, list[str]]:
    logos = images_data.get("logos", [])
    logo_url = ""
    best_logos = [logo for logo in logos if logo.get("iso_639_1") in ("pt", "en")] or logos
    if best_logos:
        best_logo = sorted(best_logos, key=lambda x: x.get("vote_average", 0), reverse=True)[0]
        lpath = best_logo.get("file_path")
        if lpath:
            logo_url = f"https://image.tmdb.org/t/p/w500{lpath}"

    backdrops = images_data.get("backdrops", [])[:12]
    photos = [f"https://image.tmdb.org/t/p/w1280{b['file_path']}" for b in backdrops if b.get("file_path")]
    return logo_url, photos


def _extract_recommendations(recs_data: dict, default_media_type: str = "movie") -> list[dict]:
    raw_results = recs_data.get("results", [])
    filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
    return [_fmt(m, default_media_type=default_media_type) for m in filtered[:12]]


def _extract_cast(data: dict) -> list[dict]:
    cast_list = []
    for c in data.get("credits", {}).get("cast", []):
        if not c.get("name"):
            continue
        profile_path = c.get("profile_path")
        cast_list.append(
            {
                "name": c.get("name", ""),
                "character": c.get("character", ""),
                "profile_url": f"https://image.tmdb.org/t/p/w185{profile_path}" if profile_path else "",
            }
        )
    return cast_list


def _extract_trailer(data: dict) -> str:
    videos = data.get("videos", {}).get("results", [])
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
            if v.get("iso_639_1") == "pt":
                return f"https://www.youtube.com/watch?v={v['key']}"
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
            return f"https://www.youtube.com/watch?v={v['key']}"
    return ""


def _extract_countries_and_languages(data: dict) -> tuple[list[str], list[str]]:
    countries = [c.get("name", "") for c in data.get("production_countries", []) if c.get("name")]
    spoken = [
        lang.get("name") or lang.get("english_name", "")
        for lang in data.get("spoken_languages", [])
        if (lang.get("name") or lang.get("english_name"))
    ]
    return countries, spoken
