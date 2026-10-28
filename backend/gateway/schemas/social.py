from typing import Optional
from pydantic import BaseModel, ConfigDict


class UserSummaryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    username: str
    created_at: str = ""
    avatar_url: str = ""


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    message: str = ""
    user_id: str
    username: str
    created_at: str = ""
    avatar_url: str = ""
    four_pillars: str = ""
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_followed_by: bool = False
    is_mutual: bool = False


class FollowActionResponse(BaseModel):
    success: bool = True
    message: str = ""
    is_mutual: bool = False


class UpdateUserProfileRequest(BaseModel):
    avatar_url: Optional[str] = None
    four_pillars: Optional[str] = None


class UpdateUserProfileResponse(BaseModel):
    success: bool = True
    message: str = ""
    avatar_url: str = ""
    four_pillars: str = ""
