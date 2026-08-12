import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullPageLoading } from './full-page-loading';

describe('FullPageLoading', () => {
  let component: FullPageLoading;
  let fixture: ComponentFixture<FullPageLoading>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullPageLoading],
    }).compileComponents();

    fixture = TestBed.createComponent(FullPageLoading);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
