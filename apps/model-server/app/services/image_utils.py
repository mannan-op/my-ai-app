import base64
import binascii
from io import BytesIO

from PIL import Image, UnidentifiedImageError


class InvalidImageError(ValueError):
    pass


def decode_base64_image(image_base64: str) -> Image.Image:
    try:
        image_bytes = base64.b64decode(_strip_data_url_prefix(image_base64), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImageError("image_base64 must be a valid base64 encoded image") from exc

    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
    except UnidentifiedImageError as exc:
        raise InvalidImageError("image_base64 could not be decoded as an image") from exc

    return image.convert("RGB")


def _strip_data_url_prefix(value: str) -> str:
    if "," in value and value.lower().startswith("data:"):
        return value.split(",", 1)[1]

    return value

