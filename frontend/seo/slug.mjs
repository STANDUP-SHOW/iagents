// One way to turn a name into an address, shared by the search-engine pages
// and the home page that links to them: two copies would drift, and a link
// built one way would point at a page generated the other way.
export const slugifier = (texte) =>
  texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
