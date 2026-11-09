// One search dialog lives in the header. Anything else opens it with this event, so
// that a trigger inside the mobile menu doesn't unmount the dialog when the menu closes.
export const OPEN_SEARCH_EVENT = "openwatch:open-search";

export const openSearch = () => {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
};
