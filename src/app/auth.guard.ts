import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './service/auth-service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isLoginPage = state.url === '/login';

  if (authService.hasValidToken()) {
    if (isLoginPage) {
      return router.createUrlTree(['/dashboard']);
    }
    return true;
  }

  if (isLoginPage) {
    return true;
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('id_token');

  authService.triggerAuthFailed();

  return router.createUrlTree(['/login']);
};
