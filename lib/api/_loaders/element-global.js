const {until, WebElement} = require('selenium-webdriver');
const Utils = require('../../utils');
const {Logger, isUndefined, isObject, isString} = Utils;
const isDefined = function(val) {
  return !isUndefined(val);
};
const Element = require('../../element');
const SeleniumTransport = require('../../transport/selenium-webdriver');

class ElementGlobal {
  static get availableElementCommands() {
    return [
      'getId',
      'findElement',
      'findElements',
      'click',
      'sendKeys',
      'getTagName',
      'getCssValue',
      'getAttribute',
      'getProperty',
      'getText',
      'getAriaRole',
      'getAccessibleName',
      'getRect',
      'isEnabled',
      'isSelected',
      'submit',
      'clear',
      'isDisplayed',
      'takeScreenshot'
    ];
  }

  static element({locator, testSuite}) {
    const instance = new ElementGlobal(testSuite);
    instance.setLocator(locator);
    instance.addLocatorToExports();

    return instance.exported();
  }

  get api() {
    return this.nightwatchInstance.api;
  }

  get reporter() {
    return this.nightwatchInstance.reporter;
  }

  get commandQueue() {
    return this.nightwatchInstance.queue;
  }

  get transport() {
    return this.nightwatchInstance.transport;
  }

  get settings() {
    return this.testSuite.settings;
  }

  constructor(testSuite) {
    this.testSuite = testSuite;
    this.suppressNotFoundErrors = false;
    this.abortOnFailure = this.settings.globals.abortOnElementLocateError;
    this.timeout = this.settings.globals.waitForConditionTimeout;
    this.retryInterval = this.settings.globals.waitForConditionPollInterval;
    this.loadCommands();
  }

  init() {
    this.nightwatchInstance = this.testSuite.client;
  }

  async findElement() {
    if (this.element) {
      return;
    }

    this.element = await this.transport.driver.wait(until.elementLocated(this.locator), this.timeout, null, this.retryInterval);
  }

  static isElementObject(element) {
    if (!isObject(element)) {
      return false;
    }

    if (!isString(element.selector)) {
      return false;
    }

    const {
      abortOnFailure, retryInterval, timeout, suppressNotFoundErrors
    } = element;

    return isDefined(abortOnFailure) || isDefined(retryInterval) || isDefined(timeout) || isDefined(suppressNotFoundErrors);
  }

  setPropertiesFromElement(element) {
    const {
      abortOnFailure, retryInterval, timeout, suppressNotFoundErrors
    } = element;

    if (!Utils.isUndefined(abortOnFailure)) {
      this.abortOnFailure = abortOnFailure;
    }

    if (!Utils.isUndefined(suppressNotFoundErrors)) {
      this.suppressNotFoundErrors = suppressNotFoundErrors;
    }

    if (!Utils.isUndefined(retryInterval)) {
      this.retryInterval = retryInterval;
    }

    if (!Utils.isUndefined(timeout)) {
      this.timeout = timeout;
    }
  }

  setLocator(locator) {
    if (locator instanceof WebElement) {
      this.element = locator;

      return;
    }

    if (locator instanceof Element || ElementGlobal.isElementObject(locator)) {
      this.setPropertiesFromElement(locator);
    }

    this.locator = SeleniumTransport.createLocator(locator);
  }

  addLocatorToExports() {
    this.exports.webElementLocator = this.locator;
    Object.freeze(this.exports);
  }

  exported() {
    return this.exports;
  }

  createCommand(commandName) {
    return function executeFn(...args) {
      const deferred = Utils.createPromise();
      const stackTrace = Utils.getOriginalStackTrace(executeFn);

      this.init();

      const {api, commandQueue} = this;
      const commandFn = async () => {
        try {
          await this.findElement();
        } catch (err) {
          if (this.suppressNotFoundErrors) {
            return null;
          }

          err.stack = stackTrace;
          Logger.error(err);

          if (this.abortOnFailure) {
            this.reporter.registerTestError(err);
          }

          return null;
        }

        Logger.error();
        const result = await this.element[commandName].apply(this.element, args);
        console.log('ELEMENT RESULT', result);

        return result;
      };

      const node = commandQueue.add({
        commandName: `element().${commandName}`,
        commandFn,
        context: api,
        args,
        stackTrace,
        namespace: null,
        deferred,
        isES6Async: true
      });

      if (api.then) {
        delete api.then;
      }
      if (api.catch) {
        delete api.catch;
      }

      api.then = function(fn) {
        Promise.prototype.then.call(node.deferred.promise, fn);
      };

      api.catch = function(fn) {
        Promise.prototype.catch.call(node.deferred.promise, fn);
      };

      return api;
    }.bind(this);
  }

  loadCommands() {
    this.exports = ElementGlobal.availableElementCommands.reduce((prev, commandName) => {
      Object.defineProperty(prev, commandName, {
        value: this.createCommand.call(this, commandName),
        writable: false
      });

      return prev;
    }, {});

    return this;
  }
}

module.exports = ElementGlobal;