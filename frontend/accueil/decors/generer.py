"""Draw the home page's scenery: the Earth seen from orbit at night, the same
Earth at sunrise, and a skyline at dawn. Generated rather than photographed
so the site owns them outright and they stay crisp at any width; the look
follows the brochures of max (08/10): deep navy, cyan light, magenta haze.

Usage: python3 -I generer.py <output folder>   (writes three .webp files)
Deterministic: the same seed draws the same pictures.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

W, H = 2560, 1440
rng = np.random.default_rng(20261008)


def bruit(w, h, echelles=((8, 1.0), (24, 0.5), (64, 0.25), (160, 0.12))):
    """Smooth value noise in [0, 1]: random grids enlarged and summed."""
    total = np.zeros((h, w), np.float32)
    poids = 0.0
    for n, a in echelles:
        g = rng.random((max(2, int(n * h / w)), n)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        total += np.asarray(im, np.float32) / 255 * a
        poids += a
    total /= poids
    return (total - total.min()) / (total.max() - total.min())


def flou(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def flou_rgb(a, r):
    return np.stack([flou(a[..., i], r) for i in range(3)], -1)


def ecran(base, ajout):
    """Screen blend: light adds without clipping hard."""
    return 1 - (1 - base) * (1 - np.clip(ajout, 0, 1))


def couleur(hexa):
    return np.array([int(hexa[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def etoiles(img, densite, masque):
    h, w, _ = img.shape
    n = int(w * h * densite)
    ys = rng.integers(0, h, n)
    xs = rng.integers(0, w, n)
    eclat = rng.random(n) ** 3
    couche = np.zeros((h, w), np.float32)
    couche[ys, xs] = eclat
    # A few bright ones get a soft halo.
    gros = np.zeros((h, w), np.float32)
    k = eclat > 0.75
    gros[ys[k], xs[k]] = eclat[k]
    lum = couche + flou(gros, 2.2) * 3
    teinte = np.stack([lum * 0.85, lum * 0.92, lum], -1)
    return ecran(img, teinte * masque[..., None])


def ciel(h_, w_, haut, bas, courbe=1.0):
    t = np.linspace(0, 1, h_, dtype=np.float32)[:, None, None] ** courbe
    return np.broadcast_to(haut * (1 - t) + bas * t, (h_, w_, 3)).copy()


def terre(lever=False):
    img = ciel(H, W, couleur('#01030b'), couleur('#04102a'), 1.4)
    # Nebula: faint magenta and cyan veils high in the sky.
    n1, n2 = bruit(W, H), bruit(W, H)
    voile = np.clip(n1 - 0.45, 0, 1) * 0.55
    voile2 = np.clip(n2 - 0.5, 0, 1) * 0.45
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    haut = np.clip(1.2 - y * 1.6, 0, 1)
    img = ecran(img, (voile * haut)[..., None] * couleur('#7a1a8c') * 0.5)
    img = ecran(img, (voile2 * haut)[..., None] * couleur('#0b6fa3') * 0.45)

    # The planet: a huge disc whose top edge crosses the lower third.
    R = W * 1.55
    cx, cy = W * 0.5, H * 0.70 + R
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    dedans = np.clip((R - d) / 2.0, 0, 1)
    img = etoiles(img, 0.0009, 1 - dedans)

    profondeur = np.clip((R - d) / (H * 0.32), 0, 1)
    sol = couleur('#020a1c') * (1 - profondeur[..., None]) + couleur('#01040d') * profondeur[..., None]
    nuages = bruit(W, H, ((6, 1.0), (20, 0.6), (70, 0.35), (220, 0.2)))
    sol = sol + (np.clip(nuages - 0.55, 0, 1) * 0.12)[..., None] * couleur('#3a6fa8') * (1 - profondeur[..., None] * 0.7)
    # City lights: clusters where a coarse mask says « land », sparkles inside.
    terres = np.clip((bruit(W, H, ((5, 1.0), (14, 0.7), (40, 0.3))) - 0.5) * 4, 0, 1)
    metropoles = np.clip((bruit(W, H, ((30, 1.0), (90, 0.6))) - 0.55) * 5, 0, 1)
    p = 0.005 * terres * (0.25 + metropoles * 2.5)
    villes = (rng.random((H, W)) < p) * rng.uniform(0.3, 1.0, (H, W)) * dedans
    villes = villes.astype(np.float32)
    villes = flou(villes, 0.5) * 2.2 + flou(villes, 2.5) * 5 + flou(villes * metropoles, 9) * 10
    pres = np.clip(1 - profondeur * 1.3, 0, 1)
    lumieres = villes[..., None] * (couleur('#ffb45a') * 0.75 + couleur('#7fe9ff') * 0.25) * (0.15 + pres[..., None] * 0.9)
    img = img * (1 - dedans[..., None]) + np.clip(sol + lumieres * 1.5, 0, 1) * dedans[..., None]

    # Atmosphere: a thin bright rim, a wide glow above it, a tint inside.
    bord = np.abs(d - R)
    liseré = np.exp(-(bord / 5.0) ** 2)
    halo = np.exp(-np.abs(d - R) / 70.0) * np.where(d > R, 1.0, np.exp(-(R - d) / 25.0))
    halo_large = np.exp(-np.abs(d - R) / 300.0) * np.where(d > R, 1.0, np.exp(-(R - d) / 60.0))
    interieur = np.exp(-np.clip(R - d, 0, None) / 140.0) * np.clip((R - d) / 6.0 + 1, 0, 1) * (d <= R + 6)
    lateral = np.abs(xx - cx) / (W * 0.5)
    teinte = couleur('#18e6ff') * (1 - lateral[..., None] * 0.6) + couleur('#c03ad6') * lateral[..., None] * 0.9
    img = ecran(img, liseré[..., None] * teinte * 0.95)
    img = ecran(img, halo[..., None] * teinte * 0.55)
    img = ecran(img, halo_large[..., None] * couleur('#2a5bd6') * 0.32)
    img = ecran(img, interieur[..., None] * couleur('#0a7fc0') * 0.18)

    if lever:
        # The sun about to rise on the limb, slightly right of centre.
        sx, sy = W * 0.62, H * 0.70 - 6
        ds = np.sqrt((xx - sx) ** 2 + ((yy - sy) * 1.6) ** 2)
        eclat = (np.exp(-(ds / 22) ** 2) * 1.2 + np.exp(-ds / 140) * 0.6 + np.exp(-ds / 520) * 0.3) * np.where(d > R, 1.0, np.exp(-(R - d) / 30.0))
        bande = np.exp(-(bord / 14.0) ** 2) * np.exp(-np.abs(xx - sx) / 700)
        chaud = couleur('#ffd9a0')
        img = ecran(img, eclat[..., None] * chaud)
        img = ecran(img, bande[..., None] * couleur('#ff9a5a') * 0.9)
        # The whole sky warms a little: progress accomplished.
        img = ecran(img, (np.exp(-np.abs(sy - yy) / 520) * np.exp(-np.clip(d - R, None, 0) ** 2 / 400))[..., None] * couleur('#5a2a8a') * 0.35)

    # A soft vignette to keep text readable at the edges.
    v = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H * 0.45) / (H * 0.8)) ** 2
    img *= (1 - np.clip(v - 0.25, 0, 1) * 0.45)[..., None]
    return img


def ville():
    """A skyline at dawn: layered towers, lit floors, haze, a warm horizon."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    horizon = H * 0.70
    t = np.clip(yy / horizon, 0, 1)[..., None]
    img = couleur('#040818') * (1 - t) ** 1.2 + couleur('#2a0f5c') * (t * (1 - t)) * 2.2 + couleur('#9a2a78') * t ** 4
    soleil = W * 0.56
    g2 = np.exp(-np.clip(horizon - yy, 0, None) / 160) * np.exp(-((xx - soleil) / (W * 0.30)) ** 2)
    img = ecran(img, g2[..., None] * couleur('#ff4f9a') * 0.7)
    g3 = np.exp(-np.clip(horizon - yy, 0, None) / 55) * np.exp(-((xx - soleil) / (W * 0.12)) ** 2)
    img = ecran(img, g3[..., None] * couleur('#ffb35a') * 0.95)
    img = etoiles(img, 0.0005, np.clip(1 - yy / (H * 0.42), 0, 1))

    def tours(base, hmin, hmax, largeur, ton, brume, fenetres, liseré, exclure=None):
        nonlocal img
        sil = np.zeros((H, W), np.float32)
        lum = np.zeros((H, W), np.float32)
        bord = np.zeros((H, W), np.float32)
        x = int(-rng.uniform(0, largeur[1]))
        while x < W:
            lw = int(rng.uniform(*largeur))
            centre = (x + lw / 2) / W
            hh = rng.uniform(hmin, hmax)
            if exclure:  # keep the middle lower, so the dawn shows through
                hh *= 1 - exclure * np.exp(-((centre - 0.56) / 0.16) ** 2)
            top = int(base - hh)
            x0, x2 = max(0, x), min(W, x + lw)
            if x2 > x0:
                sil[top:, x0:x2] = 1
                if rng.random() < 0.3:
                    cw = max(8, lw // 3); c0 = max(0, x + (lw - cw) // 2)
                    sil[top - int(hh * 0.08):top, c0:c0 + cw] = 1
                if rng.random() < 0.15:
                    sx = min(W - 3, max(2, x + lw // 2)); pt = top - int(hh * 0.22)
                    sil[pt:top, sx - 1:sx + 2] = 1
                    lum[max(0, pt - 3):pt + 3, sx - 3:sx + 4] = 3.0
                bord[top:, x0:min(W, x0 + 2)] = 1
                if fenetres:
                    pas_x, pas_y = int(rng.choice([8, 10, 12])), int(rng.choice([11, 13, 15]))
                    for fy in range(top + 10, H, pas_y):
                        etage = rng.random()
                        if etage < 0.45:
                            continue
                        taux = 0.9 if etage > 0.85 else rng.uniform(0.2, 0.6)
                        ton_f = rng.uniform(0.45, 1.0)
                        for fx in range(x0 + 5, x2 - 5, pas_x):
                            if rng.random() < taux:
                                lum[fy:fy + 4, fx:fx + 4] = ton_f
            x += lw + int(rng.uniform(2, largeur[0] * 0.25))
        sil = flou(sil, 0.7)
        lumineux = np.exp(-np.clip(base - yy, 0, None) / 400)[..., None]
        corps = ton * (1 - brume) + (couleur('#5a2a8a') * 0.55 + couleur('#ff5fa0') * 0.15 * g2[..., None]) * brume
        corps = corps * (0.75 + 0.5 * (1 - lumineux))
        img = img * (1 - sil[..., None]) + corps * sil[..., None]
        if liseré:
            b = flou(bord, 1.2) * sil * np.exp(-np.clip(yy - (base - hmax), 0, None) / 900)
            img = ecran(img, b[..., None] * couleur('#38e8ff') * liseré)
        if fenetres:
            l = lum * sil
            chaude = couleur('#ffc977') * 0.6 + couleur('#8fefff') * 0.4
            img = ecran(img, l[..., None] * chaude * fenetres)
            img = ecran(img, flou(l, 5)[..., None] * chaude * fenetres * 1.1)

    tours(horizon + 5, 60, 230, (50, 120), couleur('#3a1f6a'), 0.75, 0.25, 0.0, exclure=0.5)
    tours(horizon + 70, 120, 420, (60, 150), couleur('#140c34'), 0.4, 0.55, 0.25, exclure=0.6)
    tours(horizon + 200, 200, 650, (80, 200), couleur('#070720'), 0.12, 0.85, 0.45, exclure=0.75)
    # Ground: dark, with a haze line where the city meets it.
    sol = np.clip((yy - (horizon + 230)) / (H - horizon - 230), 0, 1)
    img = img * (1 - sol[..., None] * 0.7)
    brume = np.exp(-((yy - (horizon + 160)) / 120) ** 2) * np.exp(-((xx - soleil) / (W * 0.5)) ** 2)
    img = ecran(img, brume[..., None] * couleur('#7a2a9a') * 0.3)
    v = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H * 0.5) / (H * 0.75)) ** 2
    img *= (1 - np.clip(v - 0.35, 0, 1) * 0.45)[..., None]
    return img


def ecrire(img, chemin, qualite=82):
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))
    # A light bloom over the brightest parts, as a lens would do.
    hautes = im.point(lambda v: max(0, v - 150) * 2.4)
    im = Image.blend(im, Image.fromarray(np.clip(np.asarray(im, np.float32) + np.asarray(hautes.filter(ImageFilter.GaussianBlur(14)), np.float32) * 0.6, 0, 255).astype(np.uint8)), 1.0)
    im.save(chemin, 'WEBP', quality=qualite, method=6)
    im.resize((W // 2, H // 2), Image.LANCZOS).save(chemin.replace('.webp', '-1280.webp'), 'WEBP', quality=qualite, method=6)


if __name__ == '__main__':
    sortie = sys.argv[1]
    ecrire(terre(), f'{sortie}/decor-orbite.webp')
    ecrire(terre(lever=True), f'{sortie}/decor-lever.webp')
    ecrire(ville(), f'{sortie}/decor-ville.webp')
    print('trois décors écrits dans', sortie)
