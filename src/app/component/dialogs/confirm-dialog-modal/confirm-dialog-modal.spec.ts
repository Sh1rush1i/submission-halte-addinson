import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialogModal } from './confirm-dialog-modal';

describe('ConfirmDialogModal', () => {
  let component: ConfirmDialogModal;
  let fixture: ComponentFixture<ConfirmDialogModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
