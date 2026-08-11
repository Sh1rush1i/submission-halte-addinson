import { Routes } from '@angular/router';
import { HomePage } from './component/landing/home-page/home-page';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: HomePage },
];
