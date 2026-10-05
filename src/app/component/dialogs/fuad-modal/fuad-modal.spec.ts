import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FuadModal } from './fuad-modal';

describe('FuadModal', () => {
  let component: FuadModal;
  let fixture: ComponentFixture<FuadModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuadModal],
    }).compileComponents();

    fixture = TestBed.createComponent(FuadModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
