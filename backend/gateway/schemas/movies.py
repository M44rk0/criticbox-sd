from typing import Optional

from pydantic import BaseModel, ConfigDict


class MovieSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tmdb_id: int
    title: str
    release_date: str = ""
    poster_url: str = ""
    backdrop_url: str = ""
    overview: str = ""
    tmdb_vote_average: float = 0.0
    criticbox_rating: float = 0.0
    criticbox_review_count: int = 0
    media_type: str = "movie"


class SearchMoviesResponse(BaseModel):
    page: int = 1
    total_results: int = 0
    total_pages: int = 1
    movies: list[MovieSummary] = []


class CastMember(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    character: str = ""
    profile_url: str = ""


class SeasonInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    season_number: int
    name: str = ""
    episode_count: int = 0
    poster_url: str = ""


class NetworkInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    logo_url: str = ""


class ProviderItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider_name: str
    logo_url: str = ""


class WatchProviders(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    flatrate: list[ProviderItem] = []
    rent: list[ProviderItem] = []
    buy: list[ProviderItem] = []


class EpisodeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    episode_number: int = 0
    season_number: int = 0
    name: str = ""
    air_date: str = ""
    overview: str = ""
    still_url: str = ""
    vote_average: float = 0.0


class MovieDetailsResponse(MovieSummary):
    genres: list[str] = []
    runtime: int = 0
    directors: list[str] = []
    cast: list[CastMember] = []
    trailer_url: str = ""
    tagline: str = ""
    number_of_seasons: int = 0
    number_of_episodes: int = 0
    seasons: list[SeasonInfo] = []

    original_title: str = ""
    original_language: str = ""
    spoken_languages: list[str] = []
    certification: str = ""
    vote_count: int = 0
    popularity: float = 0.0
    budget: int = 0
    revenue: int = 0
    status: str = ""
    imdb_id: str = ""
    homepage: str = ""
    logo_url: str = ""
    photos: list[str] = []
    writers: list[str] = []
    music_composers: list[str] = []
    cinematographers: list[str] = []
    producers: list[str] = []

    networks: list[NetworkInfo] = []
    watch_providers: Optional[WatchProviders] = None
    recommendations: list[MovieSummary] = []
    last_episode_to_air: Optional[EpisodeSummary] = None
    next_episode_to_air: Optional[EpisodeSummary] = None
    first_air_date: str = ""
    last_air_date: str = ""
