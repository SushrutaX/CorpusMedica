from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import VerifiedTokenObtainPairView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/token/", VerifiedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("accounts.urls")),
]
