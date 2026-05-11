"""
Cute cottagecore QR code generator with little animals 🐝🦋🐦
"""
import io
import uuid
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw

# Pastel cottagecore colors
COLORS = {
    "bg": "#FDF9F5",           # cream
    "qr": "#4A3F4F",           # deep mauve
    "accent": "#D89AA8",       # dusty rose
    "light": "#E8C8D8",        # light mauve
    "green": "#A8D4A8",        # soft sage
}


def draw_cute_bee(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 20):
    """Draw a little bee 🐝"""
    # Body (yellow circles)
    draw.ellipse([x, y, x + size, y + size], fill="#FFE5A8", outline=COLORS["accent"], width=1)
    draw.ellipse([x + 8, y + 5, x + size - 5, y + size - 5], fill="#FFD966", outline=COLORS["accent"], width=1)

    # Wings (light)
    draw.ellipse([x - 5, y + 5, x + 5, y + 15], fill="#E8F5FF", outline="#B3D9FF", width=1)
    draw.ellipse([x + size - 5, y + 5, x + size + 5, y + 15], fill="#E8F5FF", outline="#B3D9FF", width=1)

    # Antennae
    draw.line([x + size // 2, y, x + size // 2 - 3, y - 8], fill=COLORS["accent"], width=1)
    draw.line([x + size // 2, y, x + size // 2 + 3, y - 8], fill=COLORS["accent"], width=1)


def draw_cute_butterfly(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 20):
    """Draw a little butterfly 🦋"""
    # Upper wings
    draw.ellipse([x - 8, y - 8, x + 2, y + 8], fill="#E8C8D8", outline=COLORS["accent"], width=1)
    draw.ellipse([x + size - 2, y - 8, x + size + 8, y + 8], fill="#E8C8D8", outline=COLORS["accent"], width=1)

    # Lower wings
    draw.ellipse([x - 6, y + 8, x + 4, y + 16], fill="#D89AA8", outline=COLORS["accent"], width=1)
    draw.ellipse([x + size - 4, y + 8, x + size + 6, y + 16], fill="#D89AA8", outline=COLORS["accent"], width=1)

    # Body
    draw.ellipse([x + 6, y + 2, x + 14, y + 18], fill=COLORS["accent"], outline=COLORS["accent"], width=1)


def draw_cute_bird(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 20):
    """Draw a little bird 🐦"""
    # Head
    draw.ellipse([x, y, x + 12, y + 12], fill="#A8D4A8", outline=COLORS["green"], width=1)

    # Body
    draw.ellipse([x + 8, y + 8, x + 20, y + 18], fill="#A8D4A8", outline=COLORS["green"], width=1)

    # Eye
    draw.ellipse([x + 4, y + 4, x + 7, y + 7], fill=COLORS["qr"], outline=COLORS["qr"], width=1)

    # Beak
    draw.polygon([x + 12, y + 6, x + 18, y + 7, x + 12, y + 8], fill="#FFD966", outline=COLORS["green"], width=1)

    # Tail
    draw.line([x + 20, y + 12, x + 28, y + 8], fill=COLORS["green"], width=2)


def draw_cute_flower(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 12):
    """Draw a little flower 🌸"""
    # Petals
    for angle in range(0, 360, 72):
        import math
        rad = math.radians(angle)
        px = x + size * math.cos(rad)
        py = y + size * math.sin(rad)
        draw.ellipse([px - 3, py - 3, px + 3, py + 3], fill="#FFB3D9", outline="#FF99CC", width=1)

    # Center
    draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill="#FFE5A8", outline="#FFD966", width=1)


def generate_cute_qr(data: str) -> Image.Image:
    """
    Generate a cute QR code with little animals in corners.

    Args:
        data: The data to encode in the QR code (URL with IP + token)

    Returns:
        PIL Image with cute decorated QR code
    """
    # Generate base QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=3,
    )
    qr.add_data(data)
    qr.make(fit=True)

    # Create image with cream background
    qr_img = qr.make_image(fill_color=COLORS["qr"], back_color=COLORS["bg"])
    qr_img = qr_img.convert("RGB")

    # Add padding for decorations
    padding = 60
    final_width = qr_img.width + padding * 2
    final_height = qr_img.height + padding * 2

    # Create final image with cream background
    final_img = Image.new("RGB", (final_width, final_height), color=COLORS["bg"])

    # Paste QR code in center
    final_img.paste(qr_img, (padding, padding))

    # Draw cute decorations
    draw = ImageDraw.Draw(final_img)

    # Top left: bee
    draw_cute_bee(draw, 8, 8, size=20)

    # Top right: butterfly
    draw_cute_butterfly(draw, final_width - 35, 10, size=20)

    # Bottom left: flower
    draw_cute_flower(draw, 15, final_height - 20, size=14)

    # Bottom right: bird
    draw_cute_bird(draw, final_width - 40, final_height - 30, size=20)

    # Add little flowers scattered
    draw_cute_flower(draw, 40, 20, size=10)
    draw_cute_flower(draw, final_width - 25, final_height - 15, size=10)

    return final_img


def qr_to_bytes(img: Image.Image) -> bytes:
    """Convert PIL Image to PNG bytes."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()
