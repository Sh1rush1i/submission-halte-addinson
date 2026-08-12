import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth0Domain = environment.domain;
  private clientId = environment.clientId;

  constructor(private http: HttpClient) {}

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

  register(email: string, password: string): Observable<any> {
    const payload = {
      client_id: this.clientId,
      email: email,
      password: password,
      connection: 'Username-Password-Authentication',
    };

    return this.http.post(`https://${this.auth0Domain}/dbconnections/signup`, payload);
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
