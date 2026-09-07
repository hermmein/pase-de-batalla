"""Genera una clave aleatoria larga para SESSION_SECRET (firma las cookies
de sesión) o para SECRET_KEY. Ejecuta: python scripts/generate_secret.py
"""
import secrets

if __name__ == "__main__":
    print(secrets.token_hex(32))
