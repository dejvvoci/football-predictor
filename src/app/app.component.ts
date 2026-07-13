import { Component, inject } from '@angular/core';
import { NavigationError, Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { GradingPopupComponent } from './shared/components/grading-popup/grading-popup.component';

const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed/i;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, GradingPopupComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor() {
    const router = inject(Router);
    router.events.subscribe((event) => {
      if (event instanceof NavigationError && CHUNK_LOAD_ERROR.test(event.error?.message ?? '')) {
        // Deploy i ri ka ndryshuar emrat e chunk-ëve — index.html i vjetër i browser-it referon
        // skedarë që s'ekzistojnë më. Rikarikim i plotë merr index.html-in e freskët.
        window.location.href = event.url;
      }
    });
  }
}