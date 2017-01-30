jest.unmock('..');

describe('Routing', function () {

  let Router;
  let router;

  beforeEach(() => {
    Router = require('..').Router;
    router = new Router();
  });

  describe('#add', () => {
    it('adding proper routes', () => {
      const handler = jest.fn();
      router.add('GET', '/about/', handler);
      expect(router.routes.length).toBe(1);
      expect(router.routes[0].method).toBe('GET');
      expect(router.routes[0].path).toBe('/about/');
      expect(router.routes[0].handler).toBe(handler);
    });

    it('adding proper routes without trailing slash', () => {
      const handler = jest.fn();
      router.add('GET', '/about', handler);
      expect(router.routes.length).toBe(1);
      expect(router.routes[0].method).toBe('GET');
      expect(router.routes[0].path).toBe('/about/');
      expect(router.routes[0].handler).toBe(handler);
    });

    it('adding proper routes without leading slash', () => {
      const handler = jest.fn();
      router.add('GET', 'about', handler);
      expect(router.routes.length).toBe(1);
      expect(router.routes[0].method).toBe('GET');
      expect(router.routes[0].path).toBe('/about/');
      expect(router.routes[0].handler).toBe(handler);
    });

    it('adding proper routes with lower case letters in method', () => {
      const handler = jest.fn();
      router.add('gEt', '/about', handler);
      expect(router.routes.length).toBe(1);
      expect(router.routes[0].method).toBe('GET');
      expect(router.routes[0].path).toBe('/about/');
      expect(router.routes[0].handler).toBe(handler);
    });

    it('adding unknown method must throw', () => {
      const handler = jest.fn();
      expect(function () {
        router.add('WRONG_METHOD', '/about', handler);
      }).toThrowError('Method WRONG_METHOD is not supported');
    });
  });

  describe('#buildTree', () => {
    it('builds tree', () => {
      var handler = function () {};
      router.add('GET', '/', handler);
      router.add('GET', '/about', handler);
      router.add('GET', '/posts', handler);
      router.add('GET', '/posts/:id', handler);
      router.add('GET', '/users/:id', handler);
      router.add('GET', '/users/', handler);
      router.add('GET', '/posts/:postId/comments/', handler);
      router.add('GET', '/posts/:postId/comments/:commentId', handler);
      router.add('GET', '/repos/:owner/:repo/keys/:id/', handler);
      router.add('GET', '/repos/:owner/:repo/issues/:number/labels/:name', handler);
      router.add('GET', '/my/super/long/about/page', handler);
      router.buildTree();
      expect(router.trees).toMatchSnapshot();
      // console.log(require('util').inspect(router.trees, {depth: 7, colors: true}))
    });
  });


  describe('#route', () => {
    let testTable;
    beforeEach(() => {
      testTable = [
        ['GET', '/', jest.fn(), [
          ['/', {}]
        ]],
        ['GET','/about/', jest.fn(), [
          ['/about', {}]
        ]],
        ['GET', '/posts', jest.fn(), [
          ['/posts', {}]
        ]],
        ['GET', '/posts/:id/', jest.fn(), [
          ['/posts/1', {id: '1'}],
          ['/posts/2/', {id: '2'}],
          ['/posts/abc/', {id: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/', jest.fn(), [
          ['/posts/abc/comments', {postId: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/:commentId/', jest.fn(), [
          ['/posts/abc/comments/1221', {postId: 'abc', commentId: '1221'}],
          ['/posts/abc/comments/1221/', {postId: 'abc', commentId: '1221'}],
          ['/posts/213/comments/122/', {postId: '213', commentId: '122'}],
        ]],
        ['GET', '/repos/:owner/:repo/keys/:id/', jest.fn(), [
          ['/repos/trekjs/trek/keys/233', {owner: 'trekjs', repo: 'trek', id: '233'}]
        ]],
        ['GET', '/repos/:owner/:repo/issues/:number/labels/:name/', jest.fn(), [
          ['/repos/trekjs/trek/issues/233/labels/help', {owner: 'trekjs', repo: 'trek', number:'233', name:'help'}]
        ]],
      ];
      testTable.reduce((a, [method, url, handler]) => router.add(method, url, handler), router);
      router.buildTree();
      // console.log(require('util').inspect(router.trees, {depth: 15, colors: true}))
    });

    it('test', () => {
      for (const [method, path, handler, tests] of testTable) {
        for (const [url, params] of tests) {
          const result = router.route(method, url);
          // console.log(method, url, require('util').inspect(result, {depth: 15, colors: true}));
          expect(typeof result).toBe('object');
          expect(result[0].route.handler).toBe(handler);
          expect(result[0].params).toEqual(params);
        }
      }
    });

  });

  describe('#compile', () => {
    let testTable;
    beforeEach(() => {
      testTable = [
        ['GET', '/', jest.fn(), [
          ['/', {}]
        ]],
        ['GET','/about/', jest.fn(), [
          ['/about', {}]
        ]],
        ['GET', '/posts', jest.fn(), [
          ['/posts', {}]
        ]],
        ['GET', '/posts/:id/', jest.fn(), [
          ['/posts/1', {id: '1'}],
          ['/posts/2/', {id: '2'}],
          ['/posts/abc/', {id: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/', jest.fn(), [
          ['/posts/abc/comments', {postId: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/:commentId/', jest.fn(), [
          ['/posts/abc/comments/1221', {postId: 'abc', commentId: '1221'}],
          ['/posts/abc/comments/1221/', {postId: 'abc', commentId: '1221'}],
          ['/posts/213/comments/122/', {postId: '213', commentId: '122'}],
        ]],
        ['GET', '/repos/:owner/:repo/keys/:id/', jest.fn(), [
          ['/repos/trekjs/trek/keys/233', {owner: 'trekjs', repo: 'trek', id: '233'}]
        ]],
        ['GET', '/repos/:owner/:repo/issues/:number/labels/:name/', jest.fn(), [
          ['/repos/trekjs/trek/issues/233/labels/help', {owner: 'trekjs', repo: 'trek', number:'233', name:'help'}]
        ]],
      ];
      testTable.reduce((a, [method, url, handler]) => router.add(method, url, handler), router);
      router.buildTree();
      // console.log(require('util').inspect(router.trees, {depth: 15, colors: true}))
    });
    it('compile', () => {
      router.compile();
    })

  });

  describe('#routeCompiled', () => {
    let testTable;
    beforeEach(() => {
      testTable = [
        ['GET', '/', jest.fn(), [
          ['/', {}]
        ]],
        ['GET','/about/', jest.fn(), [
          ['/about', {}]
        ]],
        ['GET', '/posts', jest.fn(), [
          ['/posts', {}]
        ]],
        ['GET', '/posts/:id/', jest.fn(), [
          ['/posts/1', {id: '1'}],
          ['/posts/2/', {id: '2'}],
          ['/posts/abc/', {id: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/', jest.fn(), [
          ['/posts/abc/comments', {postId: 'abc'}]
        ]],
        ['GET', '/posts/:postId/comments/:commentId/', jest.fn(), [
          ['/posts/abc/comments/1221', {postId: 'abc', commentId: '1221'}],
          ['/posts/abc/comments/1221/', {postId: 'abc', commentId: '1221'}],
          ['/posts/213/comments/122/', {postId: '213', commentId: '122'}],
        ]],
        ['GET', '/repos/:owner/:repo/keys/:id/', jest.fn(), [
          ['/repos/trekjs/trek/keys/233', {owner: 'trekjs', repo: 'trek', id: '233'}]
        ]],
        ['GET', '/repos/:owner/:repo/issues/:number/labels/:name/', jest.fn(), [
          ['/repos/trekjs/trek/issues/233/labels/help', {owner: 'trekjs', repo: 'trek', number:'233', name:'help'}]
        ]],
      ];
      testTable.reduce((a, [method, url, handler]) => router.add(method, url, handler), router);
      router.buildTree();
      router.compile();
      // console.loga(require('util').inspect(router.trees, {depth: 15, colors: true}))
    });

    it('test', () => {
      for (const [method, _, handler, tests] of testTable) {
        for (const [url, params] of tests) {
          const result = router.routeCompiled(method, url);
          // console.log(method, url, require('util').inspect(result, {depth: 15, colors: true}));
          expect(typeof result).toBe('object');
          expect(result[0].route.handler).toBe(handler);
          expect(result[0].params).toEqual(params);
        }
      }
    });

  });

});
