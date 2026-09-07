"""Genera el hash de la contraseña de acceso a la app (formato scrypt,
compatible con la verificación en netlify/functions/lib/password.js).

Ejecuta:  python scripts/generate_password_hash.py
(o:       python scripts/generate_password_hash.py "mi-contraseña")
Copia la línea de salida a la variable de entorno APP_PASSWORD_HASH en Netlify.
"""
import sys
import getpass
import hashlib
import secrets

N, R, P, DKLEN = 32768, 8, 1, 64


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, maxmem=64 * 1024 * 1024, dklen=DKLEN)
    return f"scrypt${N}${R}${P}${salt.hex()}${h.hex()}"


def main():
    if len(sys.argv) > 1:
        password = sys.argv[1]
    else:
        password = getpass.getpass("Nueva contraseña de acceso: ")
        confirm = getpass.getpass("Confírmala: ")
        if password != confirm:
            print("Las contraseñas no coinciden.")
            sys.exit(1)

    if not password:
        print("La contraseña no puede estar vacía.")
        sys.exit(1)

    print("\nAgrega esto como variable de entorno APP_PASSWORD_HASH en Netlify:\n")
    print(hash_password(password))


if __name__ == "__main__":
    main()
