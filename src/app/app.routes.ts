import { Routes } from '@angular/router';
import { HomePage } from './component/landing/home-page/home-page';
import { FullPageLoading } from './component/misc/full-page-loading/full-page-loading';
import { LoginPage } from './component/landing/login-page/login-page';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: HomePage,
    canActivate: [authGuard],
  },

  {
    path: 'dashboard',
    component: FullPageLoading,
    canActivate: [authGuard],
  },

  {
    path: '**',
    redirectTo: '',
  },
];
