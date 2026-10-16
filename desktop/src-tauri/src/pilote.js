// Ce que l'application exécute dans la page du navigateur, et rien d'autre.
//
// Le texte de ce fichier est fixe : il est compilé dans l'application
// (include_str! dans pilote.rs). Les valeurs venues de l'agent (un texte à
// saisir, une option) arrivent en argument, sérialisées en JSON par Rust ;
// elles ne sont jamais collées dans le code. La page, elle, ne peut rien
// appeler en retour : la fenêtre « navigateur » n'a aucune commande.
//
// Un élément est désigné par son numéro dans la liste que rend « lire », et
// par son libellé. Si la page a changé entre-temps et que le numéro ne porte
// plus le même libellé, l'action est refusée plutôt que de cliquer ailleurs.
(function (action, a) {
  'use strict'

  var SELECTEUR = [
    'input', 'textarea', 'select', 'button', 'a[href]', 'summary', 'label',
    '[role=button]', '[role=link]', '[role=checkbox]', '[role=radio]',
    '[role=combobox]', '[role=option]', '[role=menuitem]', '[role=tab]',
    '[role=switch]', '[contenteditable=""]', '[contenteditable=true]',
  ].join(',')
  var ELEMENTS_MAX = 400
  var TEXTE_MAX = 6000

  function propre(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim()
  }

  function visible(el) {
    if (el.type === 'hidden') return false
    // Une case à cocher ou un champ de fichier est souvent masqué derrière
    // une étiquette stylée : on le garde, l'agent agit dessus directement.
    if (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return true
    if (!el.getClientRects().length) return false
    var s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0
  }

  function libelleDe(el) {
    var t = el.getAttribute('aria-label')
    if (!t && el.getAttribute('aria-labelledby')) {
      t = el.getAttribute('aria-labelledby').split(/\s+/)
        .map(function (id) { var x = document.getElementById(id); return x ? x.innerText : '' })
        .join(' ')
    }
    if (!t && el.labels && el.labels.length) t = el.labels[0].innerText
    if (!t && el.closest) {
      var parent = el.closest('label')
      if (parent && parent !== el) t = parent.innerText
    }
    if (!t) t = el.getAttribute('placeholder')
    if (!t && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY' ||
      el.tagName === 'LABEL' || el.getAttribute('role'))) t = el.innerText
    if (!t && el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) t = el.value
    if (!t) t = el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('id')
    if (!t && el.querySelector) {
      var img = el.querySelector('img[alt]')
      if (img) t = img.getAttribute('alt')
    }
    return propre(t).slice(0, 120)
  }

  function genreDe(el) {
    var tag = el.tagName
    var role = el.getAttribute('role')
    if (tag === 'SELECT' || role === 'combobox') return 'liste'
    if (tag === 'TEXTAREA' || el.isContentEditable) return 'champ'
    if (tag === 'INPUT') {
      if (el.type === 'checkbox' || el.type === 'radio') return 'case'
      if (el.type === 'file') return 'fichier'
      if (el.type === 'submit' || el.type === 'button' || el.type === 'reset' || el.type === 'image') return 'bouton'
      return 'champ'
    }
    if (role === 'checkbox' || role === 'radio' || role === 'switch') return 'case'
    if (tag === 'A' || role === 'link') return 'lien'
    if (tag === 'LABEL') return 'etiquette'
    return 'bouton'
  }

  function liste() {
    var tous = document.querySelectorAll(SELECTEUR)
    var garde = []
    for (var i = 0; i < tous.length && garde.length < ELEMENTS_MAX; i++) {
      var el = tous[i]
      if (!visible(el)) continue
      // Une étiquette qui porte déjà un champ ferait doublon avec lui.
      if (el.tagName === 'LABEL' && (el.control || el.querySelector(SELECTEUR))) continue
      garde.push(el)
    }
    return garde
  }

  function decrire(el, ref) {
    var d = { ref: ref, genre: genreDe(el), libelle: libelleDe(el) }
    if (el.tagName === 'INPUT') d.type = el.type
    if (el.type === 'password') d.secret = true
    else if (d.genre === 'champ') d.valeur = propre(el.isContentEditable ? el.innerText : el.value).slice(0, 200)
    if (el.required || el.getAttribute('aria-required') === 'true') d.requis = true
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') d.desactive = true
    if (d.genre === 'case') d.coche = !!(el.checked || el.getAttribute('aria-checked') === 'true')
    if (el.getAttribute('aria-invalid') === 'true') d.invalide = true
    if (el.tagName === 'SELECT') {
      d.options = Array.prototype.slice.call(el.options, 0, 60).map(function (o) { return propre(o.text) })
      d.valeur = el.selectedIndex >= 0 ? propre(el.options[el.selectedIndex].text) : ''
    }
    if (el.tagName === 'A') d.vers = String(el.href).slice(0, 200)
    if (d.genre === 'fichier') {
      d.accepte = el.getAttribute('accept') || ''
      d.multiple = !!el.multiple
      d.fichiers = Array.prototype.map.call(el.files || [], function (f) { return f.name })
    }
    return d
  }

  function meme(attendu, trouve) {
    // Le libellé peut bouger un peu (un compteur, un astérisque) ; il ne doit
    // pas devenir un autre bouton.
    var x = propre(attendu).toLowerCase().slice(0, 40)
    var y = propre(trouve).toLowerCase().slice(0, 40)
    return !x || x === y || y.indexOf(x) === 0 || x.indexOf(y) === 0
  }

  function element(ref, libelle) {
    var el = liste()[ref]
    if (!el) throw new Error("aucun élément n° " + ref + " sur la page : relisez-la")
    var trouve = libelleDe(el)
    if (!meme(libelle, trouve)) {
      throw new Error("la page a changé : l'élément n° " + ref + " est maintenant « " + trouve +
        " » et non « " + libelle + " ». Relisez la page.")
    }
    return el
  }

  function evenements(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Pose une valeur comme le ferait la frappe : par le setter natif, sinon
  // React et Vue ne voient pas le changement et effacent le champ au rendu
  // suivant.
  function poser(el, texte) {
    if (el.isContentEditable) {
      el.focus()
      el.innerText = texte
      evenements(el)
      return
    }
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    var setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    el.focus()
    setter.call(el, texte)
    evenements(el)
  }

  function alertes() {
    var vus = []
    var noeuds = document.querySelectorAll('[role=alert], [aria-live=assertive], [aria-invalid=true], .error, .errors, .invalid-feedback, .field-error, .form-error')
    for (var i = 0; i < noeuds.length && vus.length < 20; i++) {
      var n = noeuds[i]
      var t = n.getAttribute('aria-invalid') === 'true'
        ? (n.validationMessage || '')
        : propre(n.innerText)
      if (t && vus.indexOf(t) < 0 && n.getClientRects().length) vus.push(t.slice(0, 200))
    }
    return vus
  }

  function captcha() {
    var cadres = document.querySelectorAll('iframe')
    for (var i = 0; i < cadres.length; i++) {
      var src = String(cadres[i].src || '')
      if (/recaptcha|hcaptcha|turnstile|challenges\.cloudflare|arkoselabs|funcaptcha/i.test(src)) return true
    }
    return !!document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey]')
  }

  switch (action) {
    case 'etat':
      return { pret: document.readyState, adresse: location.href, titre: document.title }

    case 'lire': {
      var elements = liste()
      return {
        adresse: location.href,
        titre: document.title,
        texte: propre(document.body ? document.body.innerText : '').slice(0, TEXTE_MAX),
        elements: elements.map(decrire),
        tronque: elements.length >= ELEMENTS_MAX,
        alertes: alertes(),
        captcha: captcha(),
        cadres: document.querySelectorAll('iframe').length,
      }
    }

    // La position d'un élément, pour qu'un vrai clic de souris l'atteigne.
    case 'cible': {
      var el = element(a.ref, a.libelle)
      el.scrollIntoView({ block: 'center', inline: 'center' })
      var r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, largeur: r.width, hauteur: r.height }
    }

    case 'cliquer': {
      var el = element(a.ref, a.libelle)
      el.scrollIntoView({ block: 'center', inline: 'center' })
      el.click()
      return { fait: true }
    }

    // Avant une vraie frappe : le curseur dans le champ, son contenu choisi
    // pour être remplacé.
    case 'focaliser': {
      var el = element(a.ref, a.libelle)
      if (el.type === 'password' && !a.secret) throw new Error('champ de mot de passe : utilisez saisir_mot_de_passe')
      el.scrollIntoView({ block: 'center' })
      el.focus()
      if (el.isContentEditable) {
        var plage = document.createRange()
        plage.selectNodeContents(el)
        var sel = getSelection()
        sel.removeAllRanges()
        sel.addRange(plage)
      } else if (typeof el.select === 'function') {
        el.select()
      }
      return { fait: document.activeElement === el }
    }

    case 'saisir': {
      var el = element(a.ref, a.libelle)
      if (el.type === 'password' && !a.secret) throw new Error('champ de mot de passe : utilisez saisir_mot_de_passe')
      if (el.tagName === 'SELECT') throw new Error("c'est une liste : utilisez choisir")
      poser(el, String(a.texte))
      return { fait: true }
    }

    // Après une vraie frappe, certains formulaires n'enregistrent qu'au
    // « change ».
    case 'confirmer': {
      var el = element(a.ref, a.libelle)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { fait: true }
    }

    case 'choisir': {
      var el = element(a.ref, a.libelle)
      if (el.tagName !== 'SELECT') throw new Error("ce n'est pas une liste simple : cliquez-la puis cliquez l'option")
      var voulu = propre(a.option).toLowerCase()
      var options = Array.prototype.slice.call(el.options)
      var o = options.filter(function (x) { return propre(x.text).toLowerCase() === voulu || String(x.value).toLowerCase() === voulu })[0] ||
        options.filter(function (x) { return propre(x.text).toLowerCase().indexOf(voulu) >= 0 })[0]
      if (!o) throw new Error('option introuvable : « ' + a.option + ' » ; options : ' + options.map(function (x) { return propre(x.text) }).join(' | '))
      el.focus()
      el.value = o.value
      evenements(el)
      return { fait: true, choisi: propre(o.text) }
    }

    case 'cocher': {
      var el = element(a.ref, a.libelle)
      var coche = !!(el.checked || el.getAttribute('aria-checked') === 'true')
      if (coche !== !!a.coche) el.click()
      return { fait: true, coche: !!(el.checked || el.getAttribute('aria-checked') === 'true') }
    }

    // Le fichier arrive en base64 depuis l'application, qui a vérifié qu'il
    // est dans le dossier de téléversement. Une page ne peut pas, elle,
    // choisir un fichier du poste.
    case 'televerser': {
      var el = element(a.ref, a.libelle)
      if (el.type !== 'file') throw new Error("ce n'est pas un champ de fichier")
      var dt = new DataTransfer()
      a.fichiers.forEach(function (f) {
        var bin = atob(f.base64)
        var octets = new Uint8Array(bin.length)
        for (var i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i)
        dt.items.add(new File([octets], f.nom, { type: f.type }))
      })
      el.files = dt.files
      evenements(el)
      return { fait: true, fichiers: Array.prototype.map.call(el.files, function (f) { return f.name }) }
    }

    // Repli quand le clavier réel n'est pas disponible.
    case 'appuyer': {
      var el = document.activeElement || document.body
      var opts = { key: a.touche, bubbles: true, cancelable: true }
      var passe = el.dispatchEvent(new KeyboardEvent('keydown', opts))
      el.dispatchEvent(new KeyboardEvent('keyup', opts))
      if (passe && a.touche === 'Enter' && el.form) {
        if (typeof el.form.requestSubmit === 'function') el.form.requestSubmit()
        else el.form.submit()
      }
      return { fait: true }
    }

    default:
      throw new Error('action inconnue : ' + action)
  }
})
