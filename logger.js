'use strict'

/**
 * Basic logger.
 */
class Logger {
  /**
   * Constructor.
   * Default level is 'info'.
   * @param {string} level - Logger level (debug, info, warn or error).
   */
  constructor (level) {
    this.levels = ['debug', 'info', 'warn', 'error']
    this.level = this.levels.reduce((acc, l, idx) => {
      if (l === level) {
        acc = idx
      }
      return acc
    }, 1) // info level by default
  }

  _log () {
    const now = new Date().toLocaleString()
    const level = arguments[0]
    const prefix = `${now} - [KeeperClient] - [${level}] `
    const p1 = arguments[1]
    const pn = Array.prototype.slice.call(arguments, 2)
    console.log.apply(console, [prefix + p1].concat(pn))
  }

  debug () {
    if (this.level === 0) {
      this._log.apply(this, ['debug'].concat(Array.prototype.slice.call(arguments)))
    }
  }

  info () {
    if (this.level >= 1) {
      this._log.apply(this, ['info'].concat(Array.prototype.slice.call(arguments)))
    }
  }

  warn () {
    if (this.level >= 2) {
      this._log.apply(this, ['warn'].concat(Array.prototype.slice.call(arguments)))
    }
  }

  error () {
    this._log.apply(this, ['error'].concat(Array.prototype.slice.call(arguments)))
  }
}

module.exports = Logger
