import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { jwtDecode } from 'jwt-decode';

export interface User {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth0Domain = environment.domain;
  private clientId = environment.clientId;

  /** Currently logged-in user, decoded from the stored id_token. Null if not logged in. */
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient) {
    // Rehydrate user object on app start/refresh if a valid token already exists.
    this.restoreUserFromToken();
  }

  login(email: string, password: string): Observable<any> {
    const payload = {
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      username: email,
      password: password,
      client_id: this.clientId,
      scope: 'openid profile email',
      realm: 'Username-Password-Authentication',
    };

    return this.http.post(`https://${this.auth0Domain}/oauth/token`, payload);
  }

  register(name: string, email: string, password: string): Observable<any> {
    const payload = {
      client_id: this.clientId,
      email: email,
      password: password,
      connection: 'Username-Password-Authentication',
      name: name,
    };

    return this.http.post(`https://${this.auth0Domain}/dbconnections/signup`, payload);
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('access_token');

    if (!token) return false;

    try {
      const decodedToken: any = jwtDecode(token);

      const currentTime = Math.floor(Date.now() / 1000);

      return decodedToken.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  hasValidToken(): boolean {
    const token = localStorage.getItem('id_token');
    if (!token) return false;

    try {
      const decodedToken: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decodedToken.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Decodes the id_token and stores the result as a typed User object in `currentUser`.
   * Call this right after a successful login (id_token must already be in localStorage).
   */
  setUserFromToken(idToken: string): User | null {
    try {
      const decoded = jwtDecode<User>(idToken);
      this.currentUser.set(decoded);
      return decoded;
    } catch (error) {
      this.currentUser.set(null);
      return null;
    }
  }

  /** Re-reads id_token from localStorage (e.g. on page refresh) and repopulates currentUser. */
  private restoreUserFromToken(): void {
    const token = localStorage.getItem('id_token');
    if (token && this.hasValidToken()) {
      this.setUserFromToken(token);
    }
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    this.currentUser.set(null);
  }

  private loginSuccessSource = new Subject();

  loginSuccess$ = this.loginSuccessSource.asObservable();

  triggerLoginSuccess() {
    this.loginSuccessSource.next(true);
  }

  private authFailedSource = new Subject<boolean>();
  authFailed$ = this.authFailedSource.asObservable();

  triggerAuthFailed() {
    this.authFailedSource.next(true);
  }
}
