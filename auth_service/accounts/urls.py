from django.urls import path

from .views import (
    EmailVerificationConfirmView,
    EmailVerificationRequestView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    UserCreateView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserCreateView.as_view(), name="users-create"),
    path(
        "password/forgot/",
        PasswordResetRequestView.as_view(),
        name="password-forgot",
    ),
    path(
        "password/reset/",
        PasswordResetConfirmView.as_view(),
        name="password-reset",
    ),
    path(
        "email/verify/request/",
        EmailVerificationRequestView.as_view(),
        name="email-verify-request",
    ),
    path(
        "email/verify/confirm/",
        EmailVerificationConfirmView.as_view(),
        name="email-verify-confirm",
    ),
]
