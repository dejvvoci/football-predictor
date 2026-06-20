import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, switchMap, take } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-my-groups',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './my-groups.component.html',
  styleUrl: './my-groups.component.css'
})
export class MyGroupsComponent implements OnInit {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);

  groups$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.groupService.getUserGroups(user.uid) : of([])))
  );

  ngOnInit(): void {
    this.authService.user$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.groupService.syncMembership(user.uid);
      }
    });
  }
}