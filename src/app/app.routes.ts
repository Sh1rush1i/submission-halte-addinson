import { Routes } from '@angular/router';
import { HomePage } from './component/landing/home-page/home-page';
import { FullPageLoading } from './component/misc/full-page-loading/full-page-loading';
import { LoginPage } from './component/landing/login-page/login-page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: HomePage },
  { path: 'inbox', component: FullPageLoading },
];
