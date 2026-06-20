import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-my-groups',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './my-groups.component.html',
  styleUrl: './my-groups.component.css'
})
export class MyGroupsComponent {
  // TODO: GroupService.getUserGroups(uid) — shfaq deri në 3 grupe + leaderboard-in privat të secilit
}
