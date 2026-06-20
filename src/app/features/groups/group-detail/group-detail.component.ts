import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { GroupService } from '../../../core/services/group.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';

interface LeaderboardRow {
  uid: string;
  displayName: string;
  points: number;
}

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent {
  private route = inject(ActivatedRoute);
  private groupService = inject(GroupService);
  private leaderboardService = inject(LeaderboardService);

  private groupId$ = this.route.paramMap.pipe(map((params) => params.get('id') ?? ''));

  group$ = this.groupId$.pipe(switchMap((id) => this.groupService.getGroup(id)));

  private members$ = this.group$.pipe(
    switchMap((group) => (group ? this.groupService.getMembers(group.memberIds) : of([])))
  );

  private scores$ = this.groupId$.pipe(
    switchMap((id) => (id ? this.leaderboardService.getGroupLeaderboard(id) : of([])))
  );

  leaderboard$ = combineLatest([this.members$, this.scores$]).pipe(
    map(([members, scores]): LeaderboardRow[] => {
      const scoreMap = new Map(scores.map((s) => [s.userId, s.points]));
      return members
        .map((m) => ({ uid: m.uid, displayName: m.displayName, points: scoreMap.get(m.uid) ?? 0 }))
        .sort((a, b) => b.points - a.points);
    })
  );
}