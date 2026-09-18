import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-info-dialog-modal',
  imports: [FormsModule, CommonModule, ButtonModule],
  templateUrl: './info-dialog-modal.html',
  styleUrl: './info-dialog-modal.css',
})
export class InfoDialogModal {
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

  closeDialog() {
    this.ref.close();
  }
}
