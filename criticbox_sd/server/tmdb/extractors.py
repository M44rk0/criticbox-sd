from criticbox_sd.server.tmdb.client import TMDB_IMAGE_BASE


def _fmt(m: dict, default_media_type: str = "movie") -> dict:
    media_type = m.get("media_type") or default_media_type
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
