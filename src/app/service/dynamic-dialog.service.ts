import { Injectable } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmDialogModal } from '../component/dialogs/confirm-dialog-modal/confirm-dialog-modal';
import { InfoDialogModal } from '../component/dialogs/info-dialog-modal/info-dialog-modal';

@Injectable({ providedIn: 'root' })
export class DynamicDialogServices {
  constructor(private dialogService: DialogService) {}

  confirmModal(message: string) {
    return this.dialogService.open(ConfirmDialogModal, {
      header: 'Confirmation',
      style: { width: '30rem' },
      contentStyle: { 'max-height': '500px', overflow: 'auto' },
      baseZIndex: 10000,
      data: {
        message: message,
      },
    });
  }

  infoModal(message: string) {
    return this.dialogService.open(InfoDialogModal, {
      header: 'Information',
      style: { width: '30rem' },
      contentStyle: { 'max-height': '500px', overflow: 'auto' },
      baseZIndex: 10000,
      data: {
        message: message,
      },
    });
  }
}
