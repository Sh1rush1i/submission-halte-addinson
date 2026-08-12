import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-full-page-loading',
  imports: [CommonModule, ProgressSpinnerModule],
  templateUrl: './full-page-loading.html',
  styleUrl: './full-page-loading.css',
})
export class FullPageLoading {}
