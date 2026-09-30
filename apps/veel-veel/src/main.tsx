const root = document.getElementById('root');
if (!root) throw new Error('Veel Veel root element is missing');
root.textContent = 'Setting the stage…';
void import('./bootstrap.js').catch((error: unknown) => {
  root.textContent = `Could not load the game: ${String(error)}`;
});
