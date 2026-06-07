from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class SetPinRequest(BaseModel):
    password: str = Field(min_length=1)
    pin: str = Field(min_length=6, max_length=6)


class RemovePinRequest(BaseModel):
    password: str = Field(min_length=1)


class VerifyPinRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6)


class PinStatusResponse(BaseModel):
    has_pin: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
