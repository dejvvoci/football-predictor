import { syncMatchesAndGrade } from './lib/sync-logic';

syncMatchesAndGrade()
  .then(() => {
    console.log('Sync u krye me sukses.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Sync dështoi:', err);
    process.exit(1);
  });