import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepartureForm } from './departure-form';

describe('DepartureForm', () => {
  let component: DepartureForm;
  let fixture: ComponentFixture<DepartureForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepartureForm],
    }).compileComponents();

    fixture = TestBed.createComponent(DepartureForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
