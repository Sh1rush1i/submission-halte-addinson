import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoDialogModal } from './info-dialog-modal';

describe('InfoDialogModal', () => {
  let component: InfoDialogModal;
  let fixture: ComponentFixture<InfoDialogModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoDialogModal],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoDialogModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
