from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_password_reset_otp"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("code_hash", models.CharField(blank=True, max_length=256)),
                ("requested_at", models.DateTimeField(auto_now=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_verification",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-requested_at"],
            },
        ),
    ]
