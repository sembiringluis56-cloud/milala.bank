/* Client-safe date helper only. Demo users/passwords and seed records are never shipped to the browser. */
window.MBSeed = Object.freeze({
  today: () => new Date().toISOString().slice(0, 10)
});
