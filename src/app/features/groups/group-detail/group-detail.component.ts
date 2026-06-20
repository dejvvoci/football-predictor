import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { MatchService } from '../../../core/services/match.service';
import { MatchCardComponent } from '../../matches/match-card/match-card.component';

interface LeaderboardRow {
  uid: string;
  displayName: string;
  points: number;
}

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, MatchCardComponent],
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

  private groupId$ = this.route.paramMap.pipe(map((params) => params.get('id') ?? ''));

  group$ = this.groupId$.pipe(switchMap((id) => this.groupService.getGroup(id)));

  currentUserId = toSignal(this.authService.user$.pipe(map((u) => u?.uid ?? null)), { initialValue: null });

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
  activeTab = signal<'predict' | 'leaderboard' | 'admin'>('predict');

  newGroupName = signal('');
  renaming = signal(false);
  renameError = signal<string | null>(null);
  removingMemberId = signal<string | null>(null);
  deletingGroup = signal(false);

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
      this.renameError.set("S'u ruajt dot emri i ri.");
    } finally {
      this.renaming.set(false);
    }
  }

  async removeMember(groupId: string, memberUserId: string, memberName: string): Promise<void> {
    const confirmed = confirm(`Të hiqet "${memberName}" nga grupi?`);
    if (!confirmed) return;

    this.removingMemberId.set(memberUserId);
    try {
      await this.groupService.removeMember(groupId, memberUserId);
    } catch {
      alert("S'u hoq dot anëtari. Provo përsëri.");
    } finally {
      this.removingMemberId.set(null);
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    const confirmed = confirm("Je i sigurt që do fshish krejt grupin? Veprimi s'kthehet mbrapsht.");
    if (!confirmed) return;

    this.deletingGroup.set(true);
    try {
      await this.groupService.deleteGroup(groupId);
      this.router.navigateByUrl('/groups');
    } catch {
      alert("S'u fshi dot grupi. Provo përsëri.");
      this.deletingGroup.set(false);
    }
  }

  async copyInviteLink(inviteCode: string): Promise<void> {
    const url = `${window.location.origin}/groups/join?code=${inviteCode}`;

    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      // Fallback nëse Clipboard API s'lejohet (p.sh. shfletues i vjetër) — shfaq linkun direkt
      alert(`Kopjo këtë link manualisht:\n${url}`);
    }
  }

  async leave(groupId: string): Promise<void> {
    const confirmed = confirm('Je i sigurt që do largohesh nga ky grup?');
    if (!confirmed) return;

    this.leaving.set(true);
    try {
      await this.groupService.leaveGroup(groupId);
      this.router.navigateByUrl('/groups');
    } catch {
      alert("S'u largua dot nga grupi. Provo përsëri.");
    } finally {
      this.leaving.set(false);
    }
  }
}