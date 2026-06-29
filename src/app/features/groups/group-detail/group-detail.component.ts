import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { MatchService } from '../../../core/services/match.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchCardComponent } from '../../matches/match-card/match-card.component';
import { HistoryItemComponent } from '../../history/history-item/history-item.component';
import { GroupChatComponent } from './group-chat/group-chat.component';
import { GroupActivityComponent } from './group-activity/group-activity.component';

interface LeaderboardRow {
  uid: string;
  displayName: string;
  points: number;
}

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, MatchCardComponent, HistoryItemComponent, GroupChatComponent, GroupActivityComponent],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private leaderboardService = inject(LeaderboardService);
  private matchService = inject(MatchService);
  private predictionService = inject(PredictionService);

  private groupId$ = this.route.paramMap.pipe(map((params) => params.get('id') ?? ''));

  group$ = this.groupId$.pipe(switchMap((id) => this.groupService.getGroup(id)));

  currentUserId = toSignal(this.authService.user$.pipe(map((u) => u?.uid ?? null)), { initialValue: null });

  groupHistory$ = combineLatest([this.groupId$, this.authService.user$]).pipe(
    switchMap(([groupId, user]) =>
      groupId && user ? this.predictionService.getUserGroupPredictions(groupId, user.uid) : of([])
    )
  );

  private matches = toSignal(this.matchService.getUpcomingMatches(), { initialValue: null });
  selectedCompetition = signal<string>('all');

  competitions = computed(() => {
    const matches = this.matches();
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.competition))).sort();
  });

  filteredMatches = computed(() => {
    const matches = this.matches();
    if (!matches) return null;

    const selected = this.selectedCompetition();
    return selected === 'all' ? matches : matches.filter((m) => m.competition === selected);
  });

  selectCompetition(value: string): void {
    this.selectedCompetition.set(value);
  }

  members$ = this.group$.pipe(
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

  leaving = signal(false);
  linkCopied = signal(false);
  activeTab = signal<'predict' | 'leaderboard' | 'history' | 'activity' | 'chat' | 'admin'>('predict');

  newGroupName = signal('');
  renaming = signal(false);
  renameError = signal<string | null>(null);
  removingMemberId = signal<string | null>(null);
  deletingGroup = signal(false);

  // Custom confirm modal
  modalVisible = signal(false);
  modalTitle = signal('');
  modalMessage = signal('');
  modalConfirmLabel = signal('Confirm');
  modalDanger = signal(false);
  private modalCallback: (() => void) | null = null;

  private openModal(title: string, message: string, confirmLabel: string, danger: boolean, cb: () => void): void {
    this.modalTitle.set(title);
    this.modalMessage.set(message);
    this.modalConfirmLabel.set(confirmLabel);
    this.modalDanger.set(danger);
    this.modalCallback = cb;
    this.modalVisible.set(true);
  }

  confirmModal(): void {
    this.modalVisible.set(false);
    this.modalCallback?.();
    this.modalCallback = null;
  }

  cancelModal(): void {
    this.modalVisible.set(false);
    this.modalCallback = null;
  }

  onNewNameChange(event: Event): void {
    this.newGroupName.set((event.target as HTMLInputElement).value);
  }

  async saveRename(groupId: string, currentName: string): Promise<void> {
    const name = this.newGroupName().trim();
    if (!name || name === currentName) return;

    this.renaming.set(true);
    this.renameError.set(null);

    try {
      await this.groupService.renameGroup(groupId, name);
      this.newGroupName.set('');
    } catch {
      this.renameError.set("Couldn't save the new name.");
    } finally {
      this.renaming.set(false);
    }
  }

  removeMember(groupId: string, memberUserId: string, memberName: string): void {
    this.openModal(
      'Remove member',
      `Remove "${memberName}" from the group?`,
      'Remove',
      true,
      async () => {
        this.removingMemberId.set(memberUserId);
        try {
          await this.groupService.removeMember(groupId, memberUserId);
        } catch {
          alert("Couldn't remove member. Please try again.");
        } finally {
          this.removingMemberId.set(null);
        }
      }
    );
  }

  deleteGroup(groupId: string): void {
    this.openModal(
      'Delete group',
      "Are you sure you want to delete this group? This action cannot be undone.",
      'Delete',
      true,
      async () => {
        this.deletingGroup.set(true);
        try {
          await this.groupService.deleteGroup(groupId);
          this.router.navigateByUrl('/groups');
        } catch {
          alert("Couldn't delete the group. Please try again.");
          this.deletingGroup.set(false);
        }
      }
    );
  }

  async copyInviteLink(inviteCode: string): Promise<void> {
    const url = `${window.location.origin}/groups/join?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      alert(`Copy this link manually:\n${url}`);
    }
  }

  leave(groupId: string): void {
    this.openModal(
      'Leave group',
      'Are you sure you want to leave this group?',
      'Leave',
      true,
      async () => {
        this.leaving.set(true);
        try {
          await this.groupService.leaveGroup(groupId);
          this.router.navigateByUrl('/groups');
        } catch {
          alert("Couldn't leave the group. Please try again.");
        } finally {
          this.leaving.set(false);
        }
      }
    );
  }
}