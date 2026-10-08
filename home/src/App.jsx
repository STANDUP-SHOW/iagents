import { Page } from './composants/Cadre.jsx';
import { pageDe } from './pages.js';
import './styles.css';

export default function App({ chemin }) {
  const page = pageDe(chemin);
  const Contenu = page.composant;
  return (
    <Page chemin={page.chemin}>
      <Contenu />
    </Page>
  );
}
