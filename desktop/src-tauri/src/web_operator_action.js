// Script de geste borne execute dans la WebView iAgent, jamais fourni par un agent.
// Le backend remplace uniquement une chaine JSON a double echappement.
// Tous les parametres sont traites comme des donnees, jamais comme du code.
// Un effet declenche n'est pas une preuve de reussite du workflow.
(function () {
  try {
    var action = JSON.parse(__IAGENT_REQUEST__);
    if (location.href !== action.adresse || location.origin !== action.origine) {
      return { statut: 'refuse', motif: 'page_modifiee' };
    }
    var court = function (valeur, limite) {
      return String(valeur == null ? '' : valeur).replace(/\s+/g, ' ').trim().slice(0, limite);
    };
    var visibles = [];
    var candidats = document.querySelectorAll(
      'button,input,select,textarea,a[href],[role="button"],[role="link"],[role="textbox"]'
    );
    for (var i = 0; i < candidats.length && visibles.length < 50; i++) {
      var el = candidats[i];
      var tag = court((el.tagName || '').toLowerCase(), 20);
      var typeChamp = court(el.getAttribute('type') || '', 24).toLowerCase();
      if (typeChamp === 'hidden' || typeChamp === 'password') continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (el.closest && el.closest('[aria-hidden="true"]')) continue;
      visibles.push(el);
    }
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= visibles.length) {
      return { statut: 'refuse', motif: 'element_introuvable' };
    }
    var cible = visibles[action.index];
    if (!cible || !cible.isConnected || cible.disabled || cible.closest('[inert]')) {
      return { statut: 'refuse', motif: 'element_non_disponible' };
    }
    var nom = court(cible.getAttribute('aria-label'), 100);
    if (!nom && cible.labels && cible.labels.length) nom = court(cible.labels[0].textContent, 100);
    if (!nom) nom = court(cible.getAttribute('placeholder'), 100);
    var tag = court((cible.tagName || '').toLowerCase(), 20);
    if (!nom && (tag === 'button' || tag === 'a' || cible.getAttribute('role') === 'button')) {
      nom = court(cible.textContent, 100);
    }
    var actuel = {
      tag: tag,
      role: court(cible.getAttribute('role') || '', 24),
      type_champ: court(cible.getAttribute('type') || '', 24).toLowerCase(),
      nom: nom,
      requis: !!cible.required,
      inactif: !!cible.disabled
    };
    var attendu = action.element;
    var champs = ['tag', 'role', 'type_champ', 'nom', 'requis', 'inactif'];
    for (var j = 0; j < champs.length; j++) {
      if (actuel[champs[j]] !== attendu[champs[j]]) {
        return { statut: 'refuse', motif: 'element_modifie' };
      }
    }
    if (action.geste === 'renseigner') {
      var type = (cible.getAttribute('type') || 'text').toLowerCase();
      var permis = ['text', 'email', 'tel', 'search', 'url', 'number'];
      if (!(tag === 'textarea' || (tag === 'input' && permis.indexOf(type) >= 0))) {
        return { statut: 'refuse', motif: 'champ_non_pris_en_charge' };
      }
      var autocomplete = (cible.getAttribute('autocomplete') || '').toLowerCase();
      if (cible.readOnly || cible.disabled ||
          /(?:^|\s)(?:cc-\S+|current-password|new-password|one-time-code|password|off)(?:\s|$)/.test(autocomplete)) {
        return { statut: 'refuse', motif: 'champ_protege' };
      }
      if (typeof action.texte !== 'string' || action.texte.length > 2000) {
        return { statut: 'refuse', motif: 'texte_invalide' };
      }
      var prototype = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (!desc || !desc.set) return { statut: 'refuse', motif: 'champ_non_editable' };
      desc.set.call(cible, action.texte);
      cible.dispatchEvent(new Event('input', { bubbles: true }));
      cible.dispatchEvent(new Event('change', { bubbles: true }));
      return { statut: 'declenche', geste: 'renseigner' };
    }
    if (action.geste === 'cliquer') {
      // Pas de formulaire, lien, bouton submit, role=button ou autre zone
      // susceptible de cacher une validation. Les boutons de SPA restent
      // potentiellement sensibles : ce prototype exige un clic HUMAIN dans
      // l'interface de confiance avant de demander ce geste.
      if (tag !== 'button' || cible.type !== 'button' || cible.closest('form') ||
          cible.hasAttribute('form') || !nom) {
        return { statut: 'refuse', motif: 'bouton_non_pris_en_charge' };
      }
      cible.click();
      return { statut: 'declenche', geste: 'cliquer' };
    }
    return { statut: 'refuse', motif: 'geste_inconnu' };
  } catch (_) {
    return { statut: 'refuse', motif: 'action_indisponible' };
  }
})()