import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';

@Component({
  selector: 'app-fuad-modal',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './fuad-modal.html',
  styleUrl: './fuad-modal.css',
})
export class FuadModal {
  constructor(private ref: DynamicDialogRef) {}

  confirm(): void {
    this.ref.close({ confirmed: true });
  }

  dismiss(): void {
    this.ref.close({ confirmed: false });
  }
}
