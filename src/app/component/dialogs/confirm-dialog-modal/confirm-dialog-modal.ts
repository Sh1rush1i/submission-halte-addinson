import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-confirm-dialog-modal',
  imports: [FormsModule, CommonModule],
  templateUrl: './confirm-dialog-modal.html',
  styleUrl: './confirm-dialog-modal.css',
})
export class ConfirmDialogModal {
  message: any = '';

  constructor(
    private dialogService: DialogService,
    private ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
  ) {}

  ngOnInit(): void {
    if (this.config.data) {
      this.message = this.config.data.message;
    }
  }

  closeDialog(data: any) {
    this.ref.close({ isValid: data });
  }
}
