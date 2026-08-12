import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthVisual } from './auth-visual';

describe('AuthVisual', () => {
  let component: AuthVisual;
  let fixture: ComponentFixture<AuthVisual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthVisual],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthVisual);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
