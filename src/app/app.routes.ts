import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'matches', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  },

  {
    path: 'matches',
    loadComponent: () =>
      import('./features/matches/matches.component').then((m) => m.MatchesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history.component').then((m) => m.HistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'stats',
    loadComponent: () =>
      import('./features/statistics/statistics.component').then((m) => m.StatisticsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./features/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'daily',
    loadComponent: () =>
      import('./features/daily-challenge/daily-hub.component').then(m => m.DailyHubComponent),
    canActivate: [authGuard]
  },
  {
    path: 'daily/player',
    loadComponent: () =>
      import('./features/daily-challenge/daily-challenge.component').then(m => m.DailyChallengeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'daily/badge',
    loadComponent: () =>
      import('./features/daily-challenge/badge-challenge/badge-challenge.component').then(m => m.BadgeChallengeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'daily/flashback',
    loadComponent: () =>
      import('./features/daily-challenge/flashback-challenge/flashback-challenge.component').then(m => m.FlashbackChallengeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'daily/topscorer',
    loadComponent: () =>
      import('./features/daily-challenge/topscorer-challenge/topscorer-challenge.component').then(m => m.TopScorerChallengeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'predict-table',
    loadComponent: () =>
      import('./features/predict-table/predict-table-list.component').then(m => m.PredictTableListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'predict-table/:code/:season',
    loadComponent: () =>
      import('./features/predict-table/predict-table-detail.component').then(m => m.PredictTableDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tournament',
    loadComponent: () =>
      import('./features/tournament/tournament.component').then((m) => m.TournamentComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tournament/create',
    loadComponent: () =>
      import('./features/tournament/create-challenge/create-challenge.component').then((m) => m.CreateChallengeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'predict-bracket',
    loadComponent: () =>
      import('./features/predict-bracket/predict-bracket-list.component').then((m) => m.PredictBracketListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'predict-bracket/:id',
    loadComponent: () =>
      import('./features/predict-bracket/bracket-detail/bracket-detail.component').then((m) => m.BracketDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'statistics',
    loadComponent: () =>
      import('./features/statistics/statistics.component').then((m) => m.StatisticsComponent),
    canActivate: [authGuard]
  },

  {
    path: 'groups',
    loadComponent: () =>
      import('./features/groups/my-groups/my-groups.component').then((m) => m.MyGroupsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'groups/create',
    loadComponent: () =>
      import('./features/groups/create-group/create-group.component').then((m) => m.CreateGroupComponent),
    canActivate: [authGuard]
  },
  {
    path: 'groups/join',
    loadComponent: () =>
      import('./features/groups/join-group/join-group.component').then((m) => m.JoinGroupComponent),
    canActivate: [authGuard]
  },
  {
    path: 'groups/:id',
    loadComponent: () =>
      import('./features/groups/group-detail/group-detail.component').then((m) => m.GroupDetailComponent),
    canActivate: [authGuard]
  },

  { path: '**', redirectTo: 'matches' }
];