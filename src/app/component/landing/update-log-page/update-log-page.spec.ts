import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateLogPage } from './update-log-page';

describe('UpdateLogPage', () => {
  let component: UpdateLogPage;
  let fixture: ComponentFixture<UpdateLogPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateLogPage],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateLogPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
