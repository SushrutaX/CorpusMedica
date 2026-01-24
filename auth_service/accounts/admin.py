from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.contrib.auth.models import User

from .models import EmailVerification
from .utils import ensure_email_verification, issue_email_verification

ROLE_CHOICES = [
    ("user", "User"),
    ("admin", "Admin"),
    ("developer", "Developer"),
]


def _apply_role(user: User, role: str) -> None:
    if role == "developer":
        user.is_superuser = True
        user.is_staff = True
    elif role == "admin":
        user.is_superuser = False
        user.is_staff = True
    else:
        user.is_superuser = False
        user.is_staff = False


class UserCreationWithRoleForm(UserCreationForm):
    role = forms.ChoiceField(choices=ROLE_CHOICES)
    email = forms.EmailField(required=True)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "email")

    def __init__(self, *args, **kwargs):
        self.current_user = kwargs.pop("current_user", None)
        super().__init__(*args, **kwargs)
        self.fields["username"].help_text = (
            "Required. Letters, digits and @/./+/-/_ only. "
            "Username cannot be an email address."
        )
        if self.current_user and not self.current_user.is_superuser:
            self.fields["role"].choices = [("user", "User")]
            self.fields["role"].initial = "user"

    def clean(self):
        cleaned = super().clean()
        username = (cleaned.get("username") or "").strip().lower()
        email = (cleaned.get("email") or "").strip().lower()
        if "@" in username:
            self.add_error("username", "Username cannot be an email address.")
        if username and email and username == email:
            self.add_error("username", "Username must be different from email.")
            self.add_error("email", "Email must be different from username.")
        if self.current_user and not self.current_user.is_superuser:
            cleaned["role"] = "user"
        return cleaned

    def save(self, commit: bool = True) -> User:
        user = super().save(commit=False)
        user.email = self.cleaned_data.get("email", "")
        role = self.cleaned_data.get("role") or "user"
        if self.current_user and not self.current_user.is_superuser:
            role = "user"
        _apply_role(user, role)
        if commit:
            user.save()
        return user


class UserChangeWithRoleForm(UserChangeForm):
    role = forms.ChoiceField(choices=ROLE_CHOICES, required=False)
    email = forms.EmailField(required=True)

    class Meta(UserChangeForm.Meta):
        model = User
        fields = ("username", "email", "password")

    def __init__(self, *args, **kwargs):
        self.current_user = kwargs.pop("current_user", None)
        super().__init__(*args, **kwargs)
        self.fields["username"].help_text = (
            "Required. Letters, digits and @/./+/-/_ only. "
            "Username cannot be an email address."
        )
        if self.instance:
            if self.instance.is_superuser:
                self.fields["role"].initial = "developer"
            elif self.instance.is_staff:
                self.fields["role"].initial = "admin"
            else:
                self.fields["role"].initial = "user"
        if self.current_user and not self.current_user.is_superuser:
            self.fields["role"].choices = [("user", "User")]
            self.fields["role"].disabled = True
            self.fields["role"].required = False

    def clean(self):
        cleaned = super().clean()
        username = (cleaned.get("username") or "").strip().lower()
        email = (cleaned.get("email") or "").strip().lower()
        if "@" in username:
            self.add_error("username", "Username cannot be an email address.")
        if username and email and username == email:
            self.add_error("username", "Username must be different from email.")
            self.add_error("email", "Email must be different from username.")
        if self.current_user and not self.current_user.is_superuser:
            cleaned["role"] = "user"
        return cleaned

    def save(self, commit: bool = True) -> User:
        user = super().save(commit=False)
        role = self.cleaned_data.get("role")
        if self.current_user and not self.current_user.is_superuser:
            role = "user"
        if role:
            _apply_role(user, role)
        if commit:
            user.save()
        return user


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationWithRoleForm
    form = UserChangeWithRoleForm
    model = User
    list_display = (
        "username",
        "email",
        "role",
        "email_verified",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    search_fields = ("username", "email")
    list_filter = ("is_staff", "is_superuser", "is_active")
    readonly_fields = ("email_verified", "email_verified_at")
    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        ("Role", {"fields": ("role",)}),
        ("Email status", {"fields": ("email_verified", "email_verified_at")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "password1",
                    "password2",
                    "role",
                    "is_active",
                ),
            },
        ),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        base_form = form

        class RequestForm(base_form):
            def __init__(self, *args, **kw):
                kw["current_user"] = request.user
                super().__init__(*args, **kw)

        return RequestForm

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related("email_verification")
        if request.user.is_superuser:
            return qs
        return qs.filter(is_staff=False, is_superuser=False)

    def has_module_permission(self, request):
        return request.user.is_staff

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and (obj.is_staff or obj.is_superuser):
            return False
        return request.user.is_staff

    def has_add_permission(self, request):
        return request.user.is_staff

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and (obj.is_staff or obj.is_superuser):
            return False
        return request.user.is_staff

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj and (obj.is_staff or obj.is_superuser):
            return False
        return request.user.is_staff

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return self.get_add_fieldsets(request)
        if request.user.is_superuser:
            return super().get_fieldsets(request, obj)
        return (
            (None, {"fields": ("username", "email", "password")}),
            ("Role", {"fields": ("role",)}),
            ("Email status", {"fields": ("email_verified", "email_verified_at")}),
            ("Status", {"fields": ("is_active",)}),
        )

    def get_add_fieldsets(self, request):
        if request.user.is_superuser:
            return self.add_fieldsets
        return (
            (
                None,
                {
                    "classes": ("wide",),
                    "fields": (
                        "username",
                        "email",
                        "password1",
                        "password2",
                        "role",
                        "is_active",
                    ),
                },
            ),
        )

    def save_model(self, request, obj, form, change):
        email_changed = change and "email" in form.changed_data
        super().save_model(request, obj, form, change)
        if obj.is_superuser:
            return
        if not change or email_changed:
            if email_changed:
                verification = ensure_email_verification(obj)
                verification.verified_at = None
                verification.save(update_fields=["verified_at"])
            try:
                issue_email_verification(obj)
            except Exception:
                messages.warning(
                    request,
                    "Unable to send verification email. Check SMTP settings.",
                )

    def _get_email_verification(self, obj: User) -> EmailVerification | None:
        try:
            return obj.email_verification
        except EmailVerification.DoesNotExist:
            return None

    @admin.display(boolean=True, description="Email verified")
    def email_verified(self, obj: User) -> bool:
        verification = self._get_email_verification(obj)
        return bool(verification and verification.verified_at)

    @admin.display(description="Verified at")
    def email_verified_at(self, obj: User):
        verification = self._get_email_verification(obj)
        return verification.verified_at if verification else None

    @admin.display(description="Role")
    def role(self, obj: User) -> str:
        if obj.is_superuser:
            return "developer"
        if obj.is_staff:
            return "admin"
        return "user"
