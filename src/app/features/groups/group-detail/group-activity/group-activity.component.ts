import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  Firestore, collection, collectionData, query, where, orderBy, limit
} from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Match } from '../../../../core/models/match.model';
import { GroupPrediction } from '../../../../core/models/group.model';
import { MatchService } from '../../../../core/services/match.service';
import { GroupService } from '../../../../core/services/group.service';
import { ReactionBarComponent } from '../../../../shared/components/reaction-bar/reaction-bar.component';

interface MatchActivity {
  match: Match;
  predictions: (GroupPrediction & { displayName: string })[];
}

@Component({
  selector: 'app-group-activity',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactionBarComponent],
  templateUrl: './group-activity.component.html',
  styleUrl: './group-activity.component.css'
})
export class GroupActivityComponent implements OnChanges {
  @Input({ required: true }) groupId!: string;
  @Input({ required: true }) memberIds!: string[];

  private firestore = inject(Firestore);
  private matchService = inject(MatchService);
  private groupService = inject(GroupService);
  private auth = inject(Auth);
  private destroyRef = inject(DestroyRef);

  private inputs$ = new BehaviorSubject<{ groupId: string; memberIds: string[] } | null>(null);

  myUid = this.auth.currentUser?.uid ?? '';
  activity$: Observable<MatchActivity[]> = this.inputs$.pipe(
    switchMap((inputs) => {
      if (!inputs?.groupId) return of([]);

      const predsRef = collection(this.firestore, 'groupPredictions');
      const q = query(
        predsRef,
        where('groupId', '==', inputs.groupId),
        orderBy('createdAt', 'desc'),
        limit(60)
      );

      const preds$ = collectionData(q, { idField: 'id' }) as Observable<GroupPrediction[]>;
      const members$ = this.groupService.getMembers(inputs.memberIds);

      return combineLatest([preds$, members$]).pipe(
        // Fetch matches with one-time reads (firstValueFrom) to avoid N simultaneous real-time listeners
        switchMap(async ([preds, members]) => {
          const memberMap = new Map(members.map((m) => [m.uid, m.displayName]));
          const gradedPreds = preds.filter((p) => p.points !== undefined);

          const byMatch = new Map<string, typeof gradedPreds>();
          for (const p of gradedPreds) {
            const arr = byMatch.get(p.matchId) ?? [];
            arr.push(p);
            byMatch.set(p.matchId, arr);
          }

          const uniqueMatchIds = [...byMatch.keys()].slice(0, 10);
          if (!uniqueMatchIds.length) return [];

          // One-time fetch per match — no real-time listeners
          const matches = await Promise.all(
            uniqueMatchIds.map((id) => firstValueFrom(this.matchService.getMatchById(id)))
          );

          const activities: MatchActivity[] = [];
          for (const match of matches) {
            if (!match) continue;
            const matchPreds = (byMatch.get(match.id) ?? []).map((p) => ({
              ...p,
              displayName: memberMap.get(p.userId) ?? 'User'
            }));
            activities.push({ match, predictions: matchPreds });
          }
          return activities.sort((a, b) => b.match.kickoff - a.match.kickoff);
        })
      );
    }),
    takeUntilDestroyed(this.destroyRef)
  );

  ngOnChanges(): void {
    this.inputs$.next({ groupId: this.groupId, memberIds: this.memberIds });
  }

  choiceLabel(choice: '1' | 'X' | '2', match: Match): string {
    if (choice === '1') return match.homeTeam;
    if (choice === '2') return match.awayTeam;
    return 'Draw';
  }

  isCorrect(prediction: GroupPrediction): boolean {
    return (prediction.points ?? 0) > 0;
  }
}