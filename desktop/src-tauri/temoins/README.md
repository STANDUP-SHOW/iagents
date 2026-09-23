# Témoins

Des fichiers écrits par **d'autres outils que le nôtre**, gardés pour que les
bancs de `lecture.rs` ne se vérifient pas seulement contre nos propres
écrivains. Un aller-retour écrire-puis-relire ne prouve que la cohérence avec
soi-même : il passerait même si les deux côtés se trompaient de la même façon.

## `classeur-d-un-autre-outil.xlsx`

Écrit par openpyxl 3.1.5, le 23/09/2026. Il porte exprès ce qui se lit mal :
des accents, une esperluette (échappée en `&amp;` dans le XML), une date et une
date-heure rangées en numéros de jour, deux booléens, un champ avec des
guillemets, un champ avec un point-virgule, une cellule vide au début d'une
ligne, et une deuxième feuille qu'on ne lit pas.

Pour le refaire :

```python
import openpyxl, datetime
c = openpyxl.Workbook()
f = c.active
f.title = "Dépenses"
f.append(["Poste", "Montant", "Échéance", "Payé", "Note"])
f.append(["Loyer & charges", 4250.00, datetime.date(2026, 9, 30), True, 'Avec "guillemets"'])
f.append(["Énergie", 1204.88, datetime.datetime(2026, 10, 15, 9, 30), False, "point-virgule ; dedans"])
f["B4"] = 7          # A4 laissé vide : la colonne doit tenir sa place
f["E4"] = "fin"
f["B2"].number_format = "#,##0.00"
c.create_sheet("Budget")["A1"] = "autre feuille"
c.save("temoins/classeur-d-un-autre-outil.xlsx")
```
