import { Routes } from '@angular/router';
import { HomePage } from './component/landing/home-page/home-page';
import { FullPageLoading } from './component/misc/full-page-loading/full-page-loading';
import { LoginPage } from './component/landing/login-page/login-page';
import { authGuard } from './auth.guard';
import { DeparturePage } from './component/landing/departure-page/departure-page';
import { DepartureForm } from './component/forms/departure-form/departure-form';

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
    path: 'departure',
    component: DeparturePage,
    canActivate: [authGuard],
  },

  {
    path: 'departure/:id',
    component: DepartureForm,
    canActivate: [authGuard],
  },

  {
    path: 'arrival',
    component: FullPageLoading,
    canActivate: [authGuard],
  },

  {
    path: '**',
    redirectTo: '',
  },
];
