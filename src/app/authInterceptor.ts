import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const messageService = inject(MessageService, { optional: true });

  const token = localStorage.getItem('access_token');
  const isMyApi =
    req.url.startsWith('https://api.backend.com') || req.url.startsWith('http://localhost:');

  let clonedRequest = req;

  if (token && isMyApi) {
    clonedRequest = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('id_token');

        if (messageService) {
          messageService.add({
            severity: 'error',
            summary: 'Sesi Habis',
            detail: 'Silakan login kembali.',
          });
        }

        router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};
