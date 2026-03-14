/**
 * Minimal util shim for React Native.
 * GramJS and other packages access util.inspect.custom and other Node.js util features.
 */
const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");

module.exports = {
  inspect: Object.assign(
    function inspect(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(obj);
      }
    },
    { custom: customInspectSymbol }
  ),
  inherits: function (ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
    }
  },
  deprecate: function (fn) {
    return fn;
  },
  debuglog: function () {
    return function () {};
  },
  format: function (...args) {
    return args.map(String).join(" ");
  },
  isArray: Array.isArray,
  isBoolean: function (v) {
    return typeof v === "boolean";
  },
  isNull: function (v) {
    return v === null;
  },
  isNullOrUndefined: function (v) {
    return v == null;
  },
  isNumber: function (v) {
    return typeof v === "number";
  },
  isString: function (v) {
    return typeof v === "string";
  },
  isUndefined: function (v) {
    return typeof v === "undefined";
  },
  isObject: function (v) {
    return typeof v === "object" && v !== null;
  },
  isFunction: function (v) {
    return typeof v === "function";
  },
  promisify: function (fn) {
    return function (...args) {
      return new Promise(function (resolve, reject) {
        fn(...args, function (err, result) {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  },
  types: {
    isUint8Array: function (v) {
      return v instanceof Uint8Array;
    },
  },
};
