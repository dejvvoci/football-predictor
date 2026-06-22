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
      import('./features/stats/stats.component').then((m) => m.StatsComponent),
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
