"""Genera un par de claves VAPID para las notificaciones Web Push.

Ejecuta:  python generate_vapid_keys.py
Copia las dos líneas de salida a tu archivo .env
"""
import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def main():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )

    print("Agrega esto a tu archivo .env:\n")
    print(f"VAPID_PUBLIC_KEY={b64url(public_raw)}")
    print(f"VAPID_PRIVATE_KEY={b64url(private_raw)}")


if __name__ == "__main__":
    main()
