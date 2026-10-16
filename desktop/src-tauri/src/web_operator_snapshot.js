// Script constant, lance uniquement par Rust dans la WebView externe du client.
// Jamais de selecteur, URL ou JavaScript fourni par le modele.
// Observation STRUCTURELLE uniquement : ni valeurs, ni cookies, ni contenu des
// courriels, ni champs mots de passe. Les informations de page restent non fiables.
(function () {
  try {
    var couper = function (valeur, limite) {
      return String(valeur == null ? '' : valeur)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limite);
    };
    var titres = [];
    var entetes = document.querySelectorAll('h1,h2,h3');
    for (var h = 0; h < entetes.length && titres.length < 8; h++) {
      var t = couper(entetes[h].textContent, 90);
      if (t) titres.push(t);
    }
    var elements = [];
    var candidats = document.querySelectorAll(
      'button,input,select,textarea,a[href],[role="button"],[role="link"],[role="textbox"]'
    );
    for (var i = 0; i < candidats.length && elements.length < 50; i++) {
      var el = candidats[i];
      var tag = couper((el.tagName || '').toLowerCase(), 20);
      var typeChamp = couper(el.getAttribute('type') || '', 24).toLowerCase();
      if (typeChamp === 'hidden' || typeChamp === 'password') continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (el.closest && el.closest('[aria-hidden="true"]')) continue;
      var nom = couper(el.getAttribute('aria-label'), 100);
      if (!nom && el.labels && el.labels.length) {
        nom = couper(el.labels[0].textContent, 100);
      }
      if (!nom && el.id) {
        // Eviter les selecteurs dynamiques et non echappes.
        var label = document.querySelector('label[for]');
        // Pour des raisons de surete, ce fallback n'extrait pas un label
        // arbitraire; aria-label, label associe et placeholder suffisent.
        void label;
      }
      if (!nom) nom = couper(el.getAttribute('placeholder'), 100);
      if (!nom && (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button')) {
        nom = couper(el.textContent, 100);
      }
      var role = couper(el.getAttribute('role') || '', 24);
      elements.push({
        tag: tag,
        role: role,
        type_champ: typeChamp,
        nom: nom,
        requis: !!el.required,
        inactif: !!el.disabled
      });
    }
    return {
      version: 1,
      origine: location.origin,
      titre: couper(document.title, 120),
      titres: titres,
      elements: elements
    };
  } catch (_) {
    return { version: 1, erreur: 'observation_indisponible' };
  }
})()