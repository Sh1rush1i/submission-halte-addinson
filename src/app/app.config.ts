import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { environment } from '../environments/environment';
import { FilterMatchMode, MessageService } from 'primeng/api';
// import { provideTranslateService } from '@ngx-translate/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular';
import { authInterceptor } from './authInterceptor';
import { DialogService } from 'primeng/dynamicdialog';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions(), withComponentInputBinding()),
    provideClientHydration(),
    provideAuth0({
      domain: environment.domain,
      clientId: environment.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
      },
    }),
    provideHttpClient(withInterceptors([authInterceptor, authHttpInterceptorFn])),
    // provideTranslateService({
    //   // loader: provideTranslateHttpLoader({
    //   //   prefix: '/assets/i18n/',
    //   //   suffix: '.json',
    //   // }),
    //   fallbackLang: 'en',
    //   lang: 'en',
    // }),
    providePrimeNG({
      license: environment.primeNG,
      ripple: true,
      overlayAppendTo: 'body',

      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities',
          },
          cssVariables: true,
        },
      },
      zIndex: {
        modal: 1100,
        overlay: 1000,
        menu: 1000,
        tooltip: 1100,
      },
      filterMatchModeOptions: {
        text: [
          FilterMatchMode.STARTS_WITH,
          FilterMatchMode.CONTAINS,
          FilterMatchMode.NOT_CONTAINS,
          FilterMatchMode.ENDS_WITH,
          FilterMatchMode.EQUALS,
          FilterMatchMode.NOT_EQUALS,
        ],
        numeric: [
          FilterMatchMode.EQUALS,
          FilterMatchMode.NOT_EQUALS,
          FilterMatchMode.LESS_THAN,
          FilterMatchMode.LESS_THAN_OR_EQUAL_TO,
          FilterMatchMode.GREATER_THAN,
          FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
        ],
        date: [
          FilterMatchMode.DATE_IS,
          FilterMatchMode.DATE_IS_NOT,
          FilterMatchMode.DATE_BEFORE,
          FilterMatchMode.DATE_AFTER,
        ],
      },
      translation: {
        accept: 'Terima',
        reject: 'Tolak',
        //translations
      },
    }),
    DialogService,
    MessageService,
    DatePipe,
    CurrencyPipe,
    CommonModule,
  ],
};
