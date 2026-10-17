// Where « Recruter cet agent » leads from a page of the site (max, 10/10): the
// agent's complete fiche in the catalogue, with the activity already chosen,
// where it goes on the recruitment list.
export function urlRecruter({ slug, activite } = {}) {
  const q = new URLSearchParams({ fiche: slug });
  if (activite) q.set('activite', activite);
  return `/catalogue?${q}`;
}
