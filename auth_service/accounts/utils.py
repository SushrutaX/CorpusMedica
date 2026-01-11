from datetime import timedelta
import secrets
from typing import Optional

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils import timezone

from .models import EmailVerification, PasswordResetOTP

OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def generate_otp() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def get_user_by_identifier(identifier: str) -> Optional[User]:
    value = (identifier or "").strip()
    if not value:
        return None
    user = User.objects.filter(email__iexact=value, is_active=True).first()
    if user:
        return user
    return User.objects.filter(username__iexact=value, is_active=True).first()


def ensure_email_verification(user: User) -> EmailVerification:
    verification, _ = EmailVerification.objects.get_or_create(user=user)
    if user.is_superuser and not verification.verified_at:
        verification.verified_at = timezone.now()
        verification.save(update_fields=["verified_at"])
    return verification


def is_email_verified(user: User) -> bool:
    if user.is_superuser:
        return True
    verification = EmailVerification.objects.filter(user=user).first()
    return bool(verification and verification.verified_at)


def _send_email(to_email: str, subject: str, message: str) -> None:
    if not settings.EMAIL_HOST:
        raise ValueError("SMTP host is not configured.")
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [to_email],
        fail_silently=False,
    )


def send_verification_email(user: User, otp: str) -> None:
    subject = "Verify your Corpus Medica email"
    message = (
        "Use this code to verify your email address:\n\n"
        f"{otp}\n\n"
        f"It expires in {OTP_EXPIRY_MINUTES} minutes. "
        "If you did not request this, you can ignore the email."
    )
    _send_email(user.email, subject, message)


def send_password_reset_email(user: User, otp: str) -> None:
    subject = "Your Corpus Medica password reset code"
    message = (
        "Use this code to reset your password:\n\n"
        f"{otp}\n\n"
        f"It expires in {OTP_EXPIRY_MINUTES} minutes. "
        "If you did not request this, you can ignore the email."
    )
    _send_email(user.email, subject, message)


def issue_email_verification(user: User) -> EmailVerification:
    if not user.email:
        raise ValueError("User does not have an email address.")
    verification = ensure_email_verification(user)
    if verification.verified_at:
        return verification
    otp = generate_otp()
    verification.code_hash = make_password(otp)
    verification.expires_at = timezone.now() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    verification.attempts = 0
    verification.save(
        update_fields=["code_hash", "expires_at", "attempts", "requested_at"]
    )
    send_verification_email(user, otp)
    return verification


def issue_password_reset(user: User) -> PasswordResetOTP:
    if not user.email:
        raise ValueError("User does not have an email address.")
    now = timezone.now()
    PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).update(
        used_at=now
    )
    otp = generate_otp()
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    entry = PasswordResetOTP.objects.create(
        user=user, code_hash=make_password(otp), expires_at=expires_at
    )
    send_password_reset_email(user, otp)
    return entry
