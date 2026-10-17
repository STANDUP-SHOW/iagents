// A brain written by hand, for the bench and the demonstration ONLY: it reads
// a few French phrases and calls the same tools a language model would. No
// route imports it — in production the brain is the Anthropic Messages API
// (`CerveauAnthropic`), and without its key the centre says it is not
// switched on. What this file proves is the plumbing (tools, journal,
// meetings, transfers, consent), not the quality of a model's answers.

import type { AppelOutil, Bloc, Cerveau, MessageCerveau, Outil, ReponseCerveau } from '../voix/fournisseurs-voix.ts';

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").toLowerCase();

export class CerveauDemonstration implements Cerveau {
  appels = 0;
  consignes: string[] = [];
  private n = 0;

  async repondre(systeme: string, messages: MessageCerveau[], outils: Outil[]): Promise<ReponseCerveau> {
    this.appels++;
    this.consignes.push(systeme);
    if (!outils.some((o) => o.nom === 'reserver_rendez_vous')) throw new Error('outils absents');
    const dernier = messages[messages.length - 1];
    const resultats = dernier.content.filter((b): b is Extract<Bloc, { type: 'tool_result' }> => b.type === 'tool_result');
    if (resultats.length) return this.texte(this.apresOutil(messages, resultats[0], systeme));
    const dit = sansAccents(dernier.content.map((b) => (b.type === 'text' ? b.text : '')).join(' '));
    const outil = (nom: string, args: Record<string, unknown> = {}) => this.outil(nom, args);

    if (/ne m'appelez plus|ne plus (etre )?(appele|contacte)|ne me contactez plus/.test(dit)) return outil('ne_plus_contacter');
    if (/conseiller|humain|quelqu'un|une vraie personne/.test(dit)) return outil('transferer_a_un_humain', { motif: 'demande de la personne', resume: dit.slice(0, 200) });
    const nom = /je m'appelle ([a-z\- ]+?) (?:de|chez) (?:l'|la |le )?([a-z\- ]+)/.exec(dit);
    if (nom) {
      const capital = (x: string) => x.trim().replace(/\b\w/g, (l) => l.toUpperCase());
      const entreprise = capital(nom[2]);
      return outil('noter_qualification', {
        nom: capital(nom[1]), entreprise, ...(/imprim/.test(dit) ? { activite: 'imprimerie' } : {}),
        ...(/(\d+) (?:postes|personnes|salaries)/.exec(dit) ? { nombre_postes: Number(/(\d+) (?:postes|personnes|salaries)/.exec(dit)![1]) } : {}),
        interet: 'chaud',
      });
    }
    if (/premier|le 1er/.test(dit)) {
      const m = /"debut":"([^"]+)"/.exec(systeme);
      return m ? outil('reserver_rendez_vous', { debut: m[1], objet: 'Présentation d’iAgent' }) : this.texte('Quel créneau préférez-vous ?');
    }
    if (/rendez-vous|rdv|rencontrer/.test(dit)) return outil('creneaux_libres');
    if (/prix|tarif|combien|cout/.test(dit)) {
      const essentiel = /Essential : (\d+) € HT par mois/.exec(systeme);
      const box = /(?:Box Commander|iAgent Station) \(?[^:]*: (\d+) € HT par mois sur 36 mois/.exec(systeme);
      return this.texte(essentiel
        ? `Un agent commence à ${essentiel[1]} euros hors taxes par mois en formule Essential${box ? `, et la Box qui l’accueille est à ${box[1]} euros par mois sur trente-six mois` : ''}. Voulez-vous qu’un conseiller vous présente l’offre ?`
        : 'Je préfère qu’un conseiller vous donne le prix exact. Voulez-vous un rendez-vous ?');
    }
    if (/au revoir|c'est tout|merci beaucoup/.test(dit)) return outil('terminer', { resume: 'fin de conversation' });
    return this.texte('Je vous écoute : que souhaitez-vous savoir sur iAgent ?');
  }

  private apresOutil(messages: MessageCerveau[], r: Extract<Bloc, { type: 'tool_result' }>, systeme: string): string {
    const demande = messages[messages.length - 2]?.content.find((b) => b.type === 'tool_use' && b.id === r.tool_use_id) as Extract<Bloc, { type: 'tool_use' }> | undefined;
    const telephone = systeme.includes('AU TÉLÉPHONE');
    switch (demande?.name) {
      case 'creneaux_libres': {
        try {
          const l = JSON.parse(r.content) as { libelle: string }[];
          return `Je peux vous proposer ${l[0].libelle} ou ${l[1].libelle}. Lequel vous convient ?`;
        } catch { return r.content; }
      }
      case 'reserver_rendez_vous': return r.content.startsWith('Réservé') ? `C’est noté. ${r.content.replace('Réservé : ', 'Rendez-vous ')}` : r.content;
      case 'noter_qualification': return `Enchanté ${String(demande.input.nom ?? '')}. Souhaitez-vous un rendez-vous avec un conseiller pour en parler ?`;
      case 'transferer_a_un_humain': return telephone ? 'Je vous passe un conseiller.' : 'Un conseiller d’iAgent Tech va vous répondre ici même.';
      case 'ne_plus_contacter': return 'C’est noté : nous ne vous contacterons plus. Au revoir.';
      case 'terminer': return 'Merci à vous, au revoir.';
      default: return 'Pardon, je n’ai pas compris.';
    }
  }

  private texte(t: string): ReponseCerveau { return { texte: t, appels: [], jetons_entree: 0, jetons_sortie: 0 }; }
  private outil(nom: string, args: Record<string, unknown>): ReponseCerveau {
    const appel: AppelOutil = { id: `demo-${++this.n}`, nom, arguments: args };
    return { texte: '', appels: [appel], jetons_entree: 0, jetons_sortie: 0 };
  }
}
