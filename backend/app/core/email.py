"""Pengirim email sederhana via SMTP.

Default menunjuk ke Mailpit lokal (tanpa auth/TLS) — email tertangkap di web
inbox http://localhost:8025. Untuk SMTP asli (Gmail/Resend), set SMTP_USER &
SMTP_PASSWORD via env; kode otomatis pakai STARTTLS + login.
"""
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings


def send_email(to: str, subject: str, html: str, text: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or "Buka email ini di klien yang mendukung HTML.")
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USER:  # SMTP asli → amankan + autentikasi
            server.starttls(context=ssl.create_default_context())
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def reset_email_html(name: str, link: str, ttl_minutes: int) -> str:
    return f"""\
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;color:#062F28">
  <h2 style="color:#062F28">Atur ulang kata sandi</h2>
  <p>Halo {name},</p>
  <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun JadeStack Anda.
     Klik tombol di bawah untuk membuat kata sandi baru.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="{link}" style="background:#9FE870;color:#062F28;text-decoration:none;
       padding:12px 28px;border-radius:8px;font-weight:600;display:inline-block">
       Atur Ulang Kata Sandi</a>
  </p>
  <p style="font-size:13px;color:#5b6b67">Tautan berlaku {ttl_minutes} menit dan hanya bisa dipakai sekali.
     Jika tombol tak berfungsi, salin tautan ini:<br>
     <span style="word-break:break-all">{link}</span></p>
  <p style="font-size:13px;color:#5b6b67">Bila Anda tidak meminta ini, abaikan email ini —
     kata sandi Anda tidak berubah.</p>
</div>"""
