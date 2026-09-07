"""Genera el hash de la contraseña de acceso a la app.

Ejecuta:  python generate_password.py
(o:       python generate_password.py "mi-contraseña")
Copia la línea de salida a tu archivo .env
"""
import sys
import getpass

from werkzeug.security import generate_password_hash


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

    print("\nAgrega esto a tu archivo .env:\n")
    print(f"APP_PASSWORD_HASH={generate_password_hash(password)}")


if __name__ == "__main__":
    main()
