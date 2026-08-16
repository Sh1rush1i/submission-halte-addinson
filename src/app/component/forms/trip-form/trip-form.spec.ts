import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripForm } from './trip-form';

describe('DepartureForm', () => {
  let component: TripForm;
  let fixture: ComponentFixture<TripForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripForm],
    }).compileComponents();

    fixture = TestBed.createComponent(TripForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
