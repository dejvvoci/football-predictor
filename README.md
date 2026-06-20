# Football Predictor ⚽

Fun project në Angular 20 për parashikime ndeshjesh futbolli, me login, leaderboard global dhe grupe private (max 3 për user).

## Struktura e projektit

```
src/app/
 ├─ core/
 │   ├─ models/      → Match, Prediction, UserProfile, Group, GroupScore
 │   ├─ services/     → AuthService, MatchService, PredictionService, LeaderboardService, GroupService (skeleton, plotësohen hap pas hapi)
 │   └─ guards/       → authGuard
 ├─ features/
 │   ├─ auth/         → login, register
 │   ├─ matches/      → ndeshjet e ditës + forma e parashikimit
 │   ├─ history/       → historiku i parashikimeve të userit
 │   ├─ leaderboard/   → renditja qendrore
 │   └─ groups/        → my-groups, create-group, join-group, group-detail
 ├─ shared/
 │   └─ components/navbar/
 ├─ app.config.ts      → providers (Router, Firebase Auth/Firestore/Functions)
 └─ app.routes.ts       → routing, lazy-loaded, mbrojtur me authGuard
```

> **Shënim:** shërbimet në `core/services/` janë skeleton tani — metodat hedhin `TODO` error dhe plotësohen në hapat e radhës (AuthService, MatchService, etj.), siç u rendit në plan.

## Setup

### 1. Instalo varësitë
```bash
npm install
```

### 2. Krijo një projekt Firebase
1. Shko te [console.firebase.google.com](https://console.firebase.google.com) → "Add project"
2. Aktivizo **Authentication** → Email/Password (Sign-in method)
3. Krijo një **Firestore Database** (production ose test mode)
4. Te "Project settings" → "Your apps" → shto një Web App, kopjo `firebaseConfig`

### 3. Plotëso konfigurimin
Hap `src/environments/environment.ts` dhe `environment.prod.ts`, zëvendëso vlerat placeholder me të dhënat reale nga Firebase:
```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...'
  }
};
```

### 4. Nis serverin lokal
```bash
npm start
```
Hap [http://localhost:4200](http://localhost:4200)

## Çfarë funksionon tani

- ✅ Routing i plotë (lazy-loaded), të gjitha faqet e mbrojtura me `authGuard`
- ✅ Lidhja me Firebase (Auth + Firestore + Functions) e konfiguruar
- ✅ Modelet e të dhënave (Match, Prediction, UserProfile, Group, GroupScore)
- ✅ Navbar funksional mes faqeve
- ⏳ Faqet janë "guaska" (skeleton) — UI dhe logjika reale plotësohen hap pas hapi

## Hapat e ardhshëm

1. AuthService + login/register (forma reale)
2. MatchService + lista e ndeshjeve me forma parashikimi
3. PredictionService + faqja e historikut
4. LeaderboardService + tabela e renditjes qendrore
5. GroupService + grupet private (max 3, leaderboard i ndarë)
6. Cloud Function: marrja e ndeshjeve nga football-data.org + gradimi automatik i parashikimeve
