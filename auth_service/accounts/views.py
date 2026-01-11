from django.contrib.auth.hashers import check_password
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import PasswordResetOTP
from .serializers import (
    VerifiedTokenObtainPairSerializer,
    MeSerializer,
    EmailVerificationConfirmSerializer,
    EmailVerificationRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserCreateSerializer,
)
from .utils import (
    OTP_MAX_ATTEMPTS,
    ensure_email_verification,
    get_user_by_identifier,
    issue_email_verification,
    issue_password_reset,
    is_email_verified,
)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class UserCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = UserCreateSerializer


class VerifiedTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedTokenObtainPairSerializer


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]

        user = get_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "Try a different username or email."},
                status=404,
            )
        if user:
            if not is_email_verified(user):
                return Response(
                    {"detail": "Email not verified. Verify before resetting."},
                    status=403,
                )
            try:
                issue_password_reset(user)
            except Exception:
                return Response(
                    {"detail": "Email delivery failed. Check SMTP settings."},
                    status=500,
                )

        return Response({"detail": "Check your email for the reset code."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        user = get_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )
        if not is_email_verified(user):
            return Response(
                {"detail": "Email not verified. Verify before resetting."},
                status=403,
            )

        otp_entry = (
            PasswordResetOTP.objects.filter(
                user=user, used_at__isnull=True
            )
            .order_by("-created_at")
            .first()
        )
        if not otp_entry:
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        now = timezone.now()
        if otp_entry.expires_at <= now:
            otp_entry.used_at = now
            otp_entry.save(update_fields=["used_at"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        if otp_entry.attempts >= OTP_MAX_ATTEMPTS:
            otp_entry.used_at = now
            otp_entry.save(update_fields=["used_at"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        if not check_password(otp, otp_entry.code_hash):
            otp_entry.attempts += 1
            if otp_entry.attempts >= OTP_MAX_ATTEMPTS:
                otp_entry.used_at = now
            otp_entry.save(update_fields=["attempts", "used_at"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        user.set_password(new_password)
        user.save()
        otp_entry.used_at = now
        otp_entry.save(update_fields=["used_at"])
        PasswordResetOTP.objects.filter(
            user=user, used_at__isnull=True
        ).exclude(id=otp_entry.id).update(used_at=now)

        return Response({"detail": "Password updated successfully."})


class EmailVerificationRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]

        user = get_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "Try a different username or email."},
                status=404,
            )
        if user:
            verification = ensure_email_verification(user)
            if verification.verified_at:
                return Response(
                    {
                        "detail": "Email already verified.",
                        "already_verified": True,
                    }
                )
            try:
                issue_email_verification(user)
            except Exception:
                return Response(
                    {"detail": "Email delivery failed. Check SMTP settings."},
                    status=500,
                )

        return Response({"detail": "Check your email for the code."})


class EmailVerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailVerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        otp = serializer.validated_data["otp"]

        user = get_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        verification = ensure_email_verification(user)
        if verification.verified_at:
            return Response({"detail": "Email already verified."})

        now = timezone.now()
        if not verification.code_hash or not verification.expires_at:
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        if verification.expires_at <= now:
            verification.code_hash = ""
            verification.expires_at = None
            verification.save(update_fields=["code_hash", "expires_at"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        if verification.attempts >= OTP_MAX_ATTEMPTS:
            verification.code_hash = ""
            verification.expires_at = None
            verification.save(update_fields=["code_hash", "expires_at"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        if not check_password(otp, verification.code_hash):
            verification.attempts += 1
            if verification.attempts >= OTP_MAX_ATTEMPTS:
                verification.code_hash = ""
                verification.expires_at = None
                verification.save(
                    update_fields=["attempts", "code_hash", "expires_at"]
                )
            else:
                verification.save(update_fields=["attempts"])
            return Response(
                {"detail": "Invalid or expired code."}, status=400
            )

        verification.verified_at = now
        verification.code_hash = ""
        verification.expires_at = None
        verification.attempts = 0
        verification.save(
            update_fields=["verified_at", "code_hash", "expires_at", "attempts"]
        )

        return Response({"detail": "Email verified successfully."})
