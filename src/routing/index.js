// flow

// All known http methods (see require('http').METHODS).
type HTTPMethod = 'ACL'|'BIND'|'CHECKOUT'|'CONNECT'|'COPY'|'DELETE'|'GET'|'HEAD'|'LINK'|'LOCK'|'M-SEARCH'|'MERGE'|'MKACTIVITY'|'MKCALENDAR'|'MKCOL'|'MOVE'|'NOTIFY'|'OPTIONS'|'PATCH'|'POST'|'PROPFIND'|'PROPPATCH'|'PURGE'|'PUT'|'REBIND'|'REPORT'|'SEARCH'|'SUBSCRIBE'|'TRACE'|'UNBIND'|'UNLINK'|'UNLOCK'|'UNSUBSCRIBE';

// Array of all methods (useful for iteration)
const HTTPMethods: Array<HTTPMethod> = ['ACL', 'BIND', 'CHECKOUT',
  'CONNECT', 'COPY', 'DELETE', 'GET', 'HEAD', 'LINK', 'LOCK',
  'M-SEARCH', 'MERGE', 'MKACTIVITY', 'MKCALENDAR', 'MKCOL', 'MOVE',
  'NOTIFY', 'OPTIONS', 'PATCH', 'POST', 'PROPFIND', 'PROPPATCH',
  'PURGE', 'PUT', 'REBIND', 'REPORT', 'SEARCH', 'SUBSCRIBE', 'TRACE',
  'UNBIND', 'UNLINK', 'UNLOCK', 'UNSUBSCRIBE'];

// NOTE
// Most of the code in this class is *not* performance critical, because it runs
// only once during application start, so outside of actual routing we could use 'slow'
// things like ES2015+, Array built-ins, sloppy string manipulation etc.

class Route {
  id: number;
  method: HTTPMethod;
  path: string;
  handler: Function;
  parametersMap: Map<string, number>;

  constructor(id: number, method: HTTPMethod, path: string, handler: Function) {
    this.id = id;
    this.method = method;
    this.path = path;
    this.handler = handler;
    this.parametersMap = new Map(path.split('/').filter(Boolean).filter(x => x[0] === ':').map((x, index) => [x.slice(1), index]).filter(Boolean));
  }
}

// Ensures that out path is properly formatted, i.e. starts with slash and ends with one
function normalizePath(source: string): string {
  source = '/' + source.split('/').map(x => x.trim()).filter(Boolean).join('/');
  if (source[source.length - 1] !== '/') source = source + '/';
  return source;
}

function normalizeMethod(method: string): string {
  if (HTTPMethods.indexOf(method) !== -1) return method;
  method = method.toUpperCase();
  if (HTTPMethods.indexOf(method) !== -1) return method;
  throw new TypeError('Method ' + method + ' is not supported');
}

class Node {
  value: string;
  children: { [key: string]: Node };
  routes: Array<Route>;
  paramNames: { [key: number]: string };

  constructor(value: string, paramNames: Array<{routeId: number, paramName: string}> = []) {
    this.value = value;
    this.children = {};
    this.routes = [];
    this.paramNames = paramNames.filter(Boolean).reduce((a, {routeId, paramName}) => Object.assign(a, {[routeId]: paramName}), {});
  }
}

export class Router {

  routes: Array<Route>;
  trees: ?{[key: HTTPMethod]: Node};
  compiled: ?(method: HTTPMethod, url: string) => Array<{route: Route, params: {[key: string]: string}}>

  constructor() {
    this.routes = [];
    this.trees = null;
  }

  // For now, just put everything in one big list and assign unique id to each route
  add(method: HTTPMethod, path: string, handler: Function): this {
    path = normalizePath(path);
    method = normalizeMethod(method);
    this.routes.push(new Route(this.routes.length, method, path, handler));
    return this;
  }

  // Build tree-like data structure from our list of routes.
  // It will serve both as a navigational structure for naive run-time routing
  // implementation (slower) and will be used for code generation of fast implementation.
  // We build separate trees for each known http method to make trees less bloated.

  // NOTE: Yes, tree for GET, or OPTIONS would certainly form largest trees, because http methods have
  // not a stellar selectivity, speaking in index lookup terms, but it would do for our little experiment.
  buildTree(): this {
    this.trees = HTTPMethods.reduce((trees, method) => {
      const routes = this.routes.filter(route => route.method === method);
      if (!routes.length) return trees;
      trees[method] = routes.reduce((tree, route) => {
        const parts = route.path.split('/').filter(Boolean);
        const treeForRoute = parts.reduce((node, part) => {
          const isParameter = part[0] === ':';
          const nextName = isParameter ? '*' : part;
          if (isParameter) {
            node.paramNames[route.id] = part.slice(1);
          }
          if (!node.children[nextName]) node.children[nextName] =
            new Node(nextName);
          node = node.children[nextName];
          return node;
        }, tree);
        treeForRoute.routes.push(route);
        return tree;
      }, new Node(''));
      return trees;
    }, {});
    return this;
  }

  // Naive routing implementation that walks our tree structure
  // looking for matched routes, and gathering params in highly
  // inefficient, but obvious way
  route(method: HTTPMethod, url: string): Array<{route: Route, params: {[key: string]: string}}> {
    if (!this.trees) this.buildTree();
    var node = this.trees[method];
    var _parts = url.split('/');
    var parts = [];
    // replacement of .filter(Boolean)
    for (var j = 0; j < _parts.length; j++) {
      if (_parts[j]) parts[parts.length] = _parts[j];
    }
    var matchedParams = [];
    for (var i = 0; i <= parts.length; i++) {
      var part = parts[i];
      matchedParams[matchedParams.length] = [node.paramNames, part];

      if (i === parts.length) {
        // We found our last node in tree, so node.routes are our matched routes
        var result = new Array(node.routes.length);
        for (var k = 0; k < node.routes.length; k++) {
          var params = {};
          // for each matched route build params that we extracted from url
          var route = node.routes[k];
          for (var l = 0; l < matchedParams.length; l++) {
            var match = matchedParams[l];
            var names = match[0];
            var value = match[1];
            if (names[route.id]) {
              params[names[route.id]] = value;
            }
          }
          result[k] = {route: route, params: params};
        }
        return result;
      }

      var nextNode = node.children[part] || node.children['*'];
      if (!nextNode) {
        throw new Error(method + ' ' + url + ' not found');
      }
      node = nextNode;
    }
    throw new Error(method + ' ' + url + ' not found');
  }

  // Generate custom routing function based on our tree structure
  // it will have same signature as naive 'route'
  compile(): this {

    var result = [];

    // Helper function to write indented body of function
    function add(s: string, level: number = 0) {
      var pad = '';
      if (level) pad = '  '.repeat(level);
      result[result.length] = pad + s;
    }

    function processNode(level: number = 0, node: Node) {
      if (node.routes.length) {
        add('if (rightWindowPos === uLen) { return [', level);
        for (var j = 0; j < node.routes.length; j++) {
          var route = node.routes[j];
          add('{route: routes[' + route.id + '],', level +1);
          add('params: {', level + 1);
          for (let [name, pos] of route.parametersMap) {
            add(name+ ': partsValues[' + pos + '],', level + 2);
          }
          add('} },', level + 1);
        }
        add('];', level);
        add('}', level);
      }

      var children = node.children;
      var childrenKeys = Object.keys(children);
      if (childrenKeys.length) {
        add(advanceWindowSnippet, level);
        add(slicePartSnippet, level);

        // Remember url parts which are possible parameter values
        if (Object.keys(node.paramNames).length) {
          add('partsValues[partsValues.length] = part;', level);
        }
        add(moveLeftWindowBorderSnippet, level);
        if (childrenKeys.length === 1 && childrenKeys[0] === '*') {
          processNode(level + 1, children['*']);
        } else {
          add('switch (part) {', level);
          for (var i in children) {
            if (i !== '*') {
              add('// checking ' + i, level);
              add('case "' + i + '": ', level);
              processNode(level + 1, children[i]);
              add('break;', level);
            }
          }
          // We want default to be last clause, so we check for it after "normal" parts
          add('default: ', level);
          if (children['*']) {
            processNode(level + 1, children['*']);
          }
          add('}', level);
        }
      }
    }

    add('var extUrlLen = url.length;');
    add('var sliceFrom = url[0] === "/" ? 1 : 0;');
    add('var sliceTo = url[extUrlLen - 1] === "/" ? -1 : extUrlLen;');
    add('var _url = "" + url.slice(sliceFrom, sliceTo);');
    add('var uLen = _url.length;');
    add('var routes = this.routes;');
    add('var leftWindowPos = -1;');
    add('var rightWindowPos = 0;');
    add('var nextSlashPos;');
    add('var part;');
    add('var partsValues = [];');
    add('var params;');

    var advanceWindowSnippet = 'nextSlashPos = _url.indexOf("/", leftWindowPos + 1); rightWindowPos = nextSlashPos === -1 ? uLen : nextSlashPos;';
    var slicePartSnippet = 'part = _url.slice(leftWindowPos + 1, rightWindowPos);';
    var moveLeftWindowBorderSnippet = 'leftWindowPos = rightWindowPos;';

    for (var method in this.trees) {
      if (this.trees.hasOwnProperty(method)) {
        add('if (method === "' + method + '") {');
        processNode(1, this.trees[method]);
        add('}');
      }
    }

    add('throw new Error(method + " " + url + " not found");');

    var body = result.join('\n');
    // console.log(body);
    this.compiled = new Function('method', 'url', body);

    return this;
  }

  routeCompiled(method: HTTPMethod, url: string): Array<{route: Route, params: {[key: string]: string}}> {
    if (!this.compiled) this.compile();
    return this.compiled(method, url);
  }

}
