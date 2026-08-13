import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeparturePage } from './departure-page';

describe('DeparturePage', () => {
  let component: DeparturePage;
  let fixture: ComponentFixture<DeparturePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeparturePage],
    }).compileComponents();

    fixture = TestBed.createComponent(DeparturePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
