from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    upload_dir: str = "/data/uploads"
    outputs_dir: str = "/data/outputs"
    models_dir: str = "/models"
    temp_dir: str = "/data/tmp"

settings = Settings()
