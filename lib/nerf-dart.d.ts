declare module 'nerf-dart' {
  /**
   * Maps a URL to an identifier.
   *
   * Name courtesy schiffertronix media LLC, a New Jersey corporation
   *
   * @param {String} uri The URL to be nerfed.
   *
   * @returns {String} A nerfed URL.
   */
  function toNerfDart(uri: string): string;
  export default toNerfDart;
}
