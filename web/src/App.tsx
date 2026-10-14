import { useRoute } from './router';

export function App() {
  const route = useRoute();
  return (
    <main>
      <h1>Truco CFR</h1>
      <p data-testid="route">{route}</p>
    </main>
  );
}
