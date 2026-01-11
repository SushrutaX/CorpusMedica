from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .utils import is_email_verified, issue_email_verification


class UserCreateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=["user", "admin"], default="user")

    class Meta:
        model = User
        fields = ("username", "email", "password", "role")
        extra_kwargs = {
            "password": {"write_only": True},
            "email": {"required": True},
            "username": {"required": True},
        }

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip().lower()
        email = (attrs.get("email") or "").strip().lower()
        if "@" in username:
            raise serializers.ValidationError(
                "Username cannot be an email address."
            )
        if username and email and username == email:
            raise serializers.ValidationError(
                "Username and email must be different."
            )
        role = attrs.get("role", "user")
        request = self.context.get("request") if hasattr(self, "context") else None
        if request and not request.user.is_superuser and role != "user":
            raise serializers.ValidationError(
                "Only developers can create admin accounts."
            )
        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role", "user")
        password = validated_data.pop("password")
        email = validated_data.get("email")
        username = validated_data.get("username")
        request = self.context.get("request") if hasattr(self, "context") else None
        if request and not request.user.is_superuser:
            role = "user"
        user = User(username=username, email=email, is_staff=(role == "admin"))
        user.set_password(password)
        user.save()
        try:
            issue_email_verification(user)
        except Exception as exc:
            user.delete()
            raise serializers.ValidationError(
                {"email": "Unable to send verification email."}
            ) from exc
        return user


class MeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "role", "is_staff", "is_superuser")

    def get_role(self, obj: User) -> str:
        if obj.is_superuser:
            return "developer"
        if obj.is_staff:
            return "admin"
        return "user"


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField()

    def validate_identifier(self, value: str) -> str:
        return value.strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    otp = serializers.CharField(min_length=4, max_length=10)
    new_password = serializers.CharField(write_only=True)

    def validate_identifier(self, value: str) -> str:
        return value.strip()

    def validate_new_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value


class EmailVerificationRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField()

    def validate_identifier(self, value: str) -> str:
        return value.strip()


class EmailVerificationConfirmSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    otp = serializers.CharField(min_length=4, max_length=10)

    def validate_identifier(self, value: str) -> str:
        return value.strip()


class VerifiedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = (
            (attrs.get("identifier") or "")
            or (attrs.get("username") or "")
            or (attrs.get("email") or "")
        )
        if identifier:
            if "@" in identifier:
                user = User.objects.filter(email__iexact=identifier).first()
                if user:
                    attrs[self.username_field] = user.get_username()
            else:
                attrs[self.username_field] = identifier
        data = super().validate(attrs)
        user = self.user
        if user and not is_email_verified(user):
            raise serializers.ValidationError("Email not verified.")
        return data
