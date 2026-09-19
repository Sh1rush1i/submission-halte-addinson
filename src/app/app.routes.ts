import { Routes } from '@angular/router';
import { HomePage } from './component/landing/home-page/home-page';
import { FullPageLoading } from './component/misc/full-page-loading/full-page-loading';
import { LoginPage } from './component/landing/login-page/login-page';
import { authGuard } from './auth.guard';
import { TripPage } from './component/landing/trip-page/trip-page';
import { TripForm } from './component/forms/trip-form/trip-form';
import { AboutPage } from './component/landing/about-page/about-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [authGuard] },
  { path: 'home', component: HomePage, canActivate: [authGuard] },
  { path: 'about', component: AboutPage, canActivate: [authGuard] },
  { path: 'trip', component: TripPage, canActivate: [authGuard] },
  { path: 'trip/:id', component: TripForm, canActivate: [authGuard] },
  { path: 'arrival', component: FullPageLoading, canActivate: [authGuard] },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
