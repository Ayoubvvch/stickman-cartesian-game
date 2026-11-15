(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});

  const MATH_FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sec: (v) => 1 / Math.cos(v),
    csc: (v) => 1 / Math.sin(v),
    cot: (v) => 1 / Math.tan(v),
    abs: Math.abs,
    sqrt: Math.sqrt,
    ln: Math.log,
    log: Math.log10 ? Math.log10 : (v) => Math.log(v) / Math.LN10,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
  };

  const TWO_ARG_FUNCS = new Set(['min', 'max']);

  const MATH_CONSTS = {
    pi: Math.PI,
    tau: Math.PI * 2,
    e: Math.E,
  };

  const NON_DIFF_FUNCS = new Set(['floor', 'ceil', 'round', 'sign', 'min', 'max']);

  function tokenize(expr) {
    const tokens = [];
    const s = String(expr || '').trim();
    let i = 0;

    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
        continue;
      }

      if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9')) {
        let end = i;
        let seenDot = false;
        while (end < s.length) {
          const c = s[end];
          if (c >= '0' && c <= '9') {
            end++;
          } else if (c === '.' && !seenDot) {
            seenDot = true;
            end++;
          } else {
            break;
          }
        }
        if (
          end < s.length &&
          (s[end] === 'e' || s[end] === 'E') &&
          (s[end + 1] === '+' || s[end + 1] === '-' || (s[end + 1] >= '0' && s[end + 1] <= '9'))
        ) {
          let expEnd = end + 1;
          if (s[expEnd] === '+' || s[expEnd] === '-') expEnd++;
          let hasDigit = false;
          while (expEnd < s.length && s[expEnd] >= '0' && s[expEnd] <= '9') {
            expEnd++;
            hasDigit = true;
          }
          if (hasDigit) end = expEnd;
        }
        const num = Number(s.slice(i, end));
        if (!Number.isFinite(num)) {
          throw new Error('Invalid number');
        }
        tokens.push({ type: 'num', value: num });
        i = end;
        continue;
      }

      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === 'π' || ch === 'τ') {
        if (ch === 'π') {
          tokens.push({ type: 'const', value: 'pi' });
          i++;
          continue;
        }
        if (ch === 'τ') {
          tokens.push({ type: 'const', value: 'tau' });
          i++;
          continue;
        }
        let end = i + 1;
        while (
          end < s.length &&
          ((s[end] >= 'a' && s[end] <= 'z') || (s[end] >= 'A' && s[end] <= 'Z'))
        ) {
          end++;
        }
        const word = s.slice(i, end).toLowerCase();
        if (word === 'x') {
          tokens.push({ type: 'var', value: 'x' });
        } else if (Object.prototype.hasOwnProperty.call(MATH_CONSTS, word)) {
          tokens.push({ type: 'const', value: word });
        } else if (Object.prototype.hasOwnProperty.call(MATH_FUNCS, word)) {
          tokens.push({ type: 'func', value: word });
        } else {
          throw new Error(`Unknown identifier: ${word}`);
        }
        i = end;
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }
      if (ch === '×' || ch === '·') {
        tokens.push({ type: 'op', value: '*' });
        i++;
        continue;
      }
      if (ch === '÷') {
        tokens.push({ type: 'op', value: '/' });
        i++;
        continue;
      }
      if (ch === '−') {
        tokens.push({ type: 'op', value: '-' });
        i++;
        continue;
      }
      if (ch === '(' || ch === ')' || ch === ',') {
        tokens.push({ type: ch, value: ch });
        i++;
        continue;
      }

      throw new Error(`Unexpected symbol "${ch}"`);
    }

    const out = [];
    for (let t = 0; t < tokens.length; t++) {
      const curr = tokens[t];
      if (t > 0) {
        const prev = tokens[t - 1];
        const prevIsValue =
          prev.type === 'num' || prev.type === 'var' || prev.type === 'const' || prev.type === ')';
        const currStartsFactor =
          curr.type === 'num' ||
          curr.type === 'var' ||
          curr.type === 'const' ||
          curr.type === 'func' ||
          curr.type === '(';
        if (prevIsValue && currStartsFactor) {
          out.push({ type: 'op', value: '*' });
        }
      }
      out.push(curr);
    }

    return out;
  }

  function parseAst(tokens) {
    let pos = 0;
    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++];

    function parseExpr() {
      let node = parseTerm();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseTerm();
        node = { type: 'bin', op, left: node, right };
      }
      return node;
    }

    function parseTerm() {
      let node = parseUnary();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        const right = parseUnary();
        node = { type: 'bin', op, left: node, right };
      }
      return node;
    }

    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const arg = parseUnary();
        return op === '-' ? { type: 'neg', arg } : arg;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        consume();
        const exp = parseUnary();
        return { type: 'bin', op: '^', left: base, right: exp };
      }
      return base;
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) {
        throw new Error('Unexpected end of formula');
      }
      if (tok.type === 'num') {
        consume();
        return { type: 'num', value: tok.value };
      }
      if (tok.type === 'var') {
        consume();
        return { type: 'var', name: 'x' };
      }
      if (tok.type === 'const') {
        consume();
        return { type: 'const', name: tok.value, value: MATH_CONSTS[tok.value] };
      }
      if (tok.type === 'func') {
        consume();
        const name = tok.value;
        if (!peek() || peek().type !== '(') {
          throw new Error(`Expected "(" after ${name}`);
        }
        consume();
        const args = [parseExpr()];
        if (TWO_ARG_FUNCS.has(name) && peek() && peek().type === ',') {
          consume();
          args.push(parseExpr());
        }
        if (!peek() || peek().type !== ')') {
          throw new Error(`Missing ")" after ${name}(...)`);
        }
        consume();
        if (TWO_ARG_FUNCS.has(name) && args.length !== 2) {
          throw new Error(`${name}(a, b) requires 2 arguments`);
        }
        return { type: 'call', name, args };
      }
      if (tok.type === '(') {
        consume();
        const inner = parseExpr();
        if (!peek() || peek().type !== ')') {
          throw new Error('Missing closing ")"');
        }
        consume();
        return inner;
      }
      throw new Error(`Unexpected token "${tok.value}"`);
    }

    const ast = parseExpr();
    if (pos < tokens.length) {
      throw new Error(`Unexpected "${tokens[pos].value}"`);
    }
    return ast;
  }

  function isZero(n) {
    return n && n.type === 'num' && Math.abs(n.value) < 1e-12;
  }

  function isOne(n) {
    return n && n.type === 'num' && Math.abs(n.value - 1) < 1e-12;
  }

  function isMinusOne(n) {
    return n && n.type === 'num' && Math.abs(n.value + 1) < 1e-12;
  }

  function numNode(v) {
    const clean = Math.abs(v) < 1e-12 ? 0 : Number(v.toFixed(10));
    return { type: 'num', value: clean };
  }

  function simplifyAst(node) {
    if (!node) return node;
    if (node.type === 'num' || node.type === 'var' || node.type === 'const') {
      return node;
    }

    if (node.type === 'neg') {
      const a = simplifyAst(node.arg);
      if (a.type === 'num') return numNode(-a.value);
      if (a.type === 'neg') return a.arg;
      if (a.type === 'bin' && a.op === '*' && a.left.type === 'num') {
        return simplifyAst({ type: 'bin', op: '*', left: numNode(-a.left.value), right: a.right });
      }
      return { type: 'neg', arg: a };
    }

    if (node.type === 'call') {
      const args = node.args.map(simplifyAst);
      if (args.length === 1 && args[0].type === 'num') {
        const val = MATH_FUNCS[node.name](args[0].value);
        if (Number.isFinite(val)) return numNode(val);
      }
      return { type: 'call', name: node.name, args };
    }

    if (node.type === 'bin') {
      let l = simplifyAst(node.left);
      let r = simplifyAst(node.right);
      const op = node.op;

      if (l.type === 'num' && r.type === 'num') {
        let res = NaN;
        if (op === '+') res = l.value + r.value;
        else if (op === '-') res = l.value - r.value;
        else if (op === '*') res = l.value * r.value;
        else if (op === '/' && Math.abs(r.value) > 1e-12) res = l.value / r.value;
        else if (op === '^') res = Math.pow(l.value, r.value);
        if (Number.isFinite(res)) return numNode(res);
      }

      if (op === '+') {
        if (isZero(l)) return r;
        if (isZero(r)) return l;
        if (r.type === 'neg') return simplifyAst({ type: 'bin', op: '-', left: l, right: r.arg });
        if (r.type === 'num' && r.value < 0) {
          return { type: 'bin', op: '-', left: l, right: numNode(-r.value) };
        }
        if (r.type === 'bin' && r.op === '*' && r.left.type === 'num' && r.left.value < 0) {
          return {
            type: 'bin',
            op: '-',
            left: l,
            right: simplifyAst({ type: 'bin', op: '*', left: numNode(-r.left.value), right: r.right }),
          };
        }
        return { type: 'bin', op: '+', left: l, right: r };
      }

      if (op === '-') {
        if (isZero(r)) return l;
        if (isZero(l)) return simplifyAst({ type: 'neg', arg: r });
        if (r.type === 'neg') return simplifyAst({ type: 'bin', op: '+', left: l, right: r.arg });
        if (r.type === 'num' && r.value < 0) {
          return { type: 'bin', op: '+', left: l, right: numNode(-r.value) };
        }
        return { type: 'bin', op: '-', left: l, right: r };
      }

      if (op === '*') {
        if (isZero(l) || isZero(r)) return numNode(0);
        if (isOne(l)) return r;
        if (isOne(r)) return l;
        if (isMinusOne(l)) return simplifyAst({ type: 'neg', arg: r });
        if (isMinusOne(r)) return simplifyAst({ type: 'neg', arg: l });
        if (r.type === 'num' && l.type !== 'num') {
          return simplifyAst({ type: 'bin', op: '*', left: r, right: l });
        }
        if (l.type === 'num' && r.type === 'bin' && r.op === '*' && r.left.type === 'num') {
          return simplifyAst({
            type: 'bin',
            op: '*',
            left: numNode(l.value * r.left.value),
            right: r.right,
          });
        }
        if (l.type === 'num' && r.type === 'neg') {
          return simplifyAst({ type: 'bin', op: '*', left: numNode(-l.value), right: r.arg });
        }
        if (l.type === 'neg' && r.type === 'neg') {
          return simplifyAst({ type: 'bin', op: '*', left: l.arg, right: r.arg });
        }
        return { type: 'bin', op: '*', left: l, right: r };
      }

      if (op === '/') {
        if (isZero(l)) return numNode(0);
        if (isOne(r)) return l;
        if (isMinusOne(r)) return simplifyAst({ type: 'neg', arg: l });
        return { type: 'bin', op: '/', left: l, right: r };
      }

      if (op === '^') {
        if (isZero(r)) return numNode(1);
        if (isOne(r)) return l;
        if (isZero(l)) return numNode(0);
        if (isOne(l)) return numNode(1);
        return { type: 'bin', op: '^', left: l, right: r };
      }
    }

    return node;
  }

  function hasVariableX(node) {
    if (!node) return false;
    if (node.type === 'var') return true;
    if (node.type === 'neg') return hasVariableX(node.arg);
    if (node.type === 'bin') return hasVariableX(node.left) || hasVariableX(node.right);
    if (node.type === 'call') return node.args.some(hasVariableX);
    return false;
  }

  function canDifferentiateSymbolically(node) {
    if (!node) return false;
    if (node.type === 'call') {
      if (NON_DIFF_FUNCS.has(node.name)) return false;
      return node.args.every(canDifferentiateSymbolically);
    }
    if (node.type === 'neg') return canDifferentiateSymbolically(node.arg);
    if (node.type === 'bin') {
      return canDifferentiateSymbolically(node.left) && canDifferentiateSymbolically(node.right);
    }
    return true;
  }

  function diffAst(node) {
    if (!hasVariableX(node)) {
      return numNode(0);
    }
    if (node.type === 'var') {
      return numNode(1);
    }
    if (node.type === 'neg') {
      return simplifyAst({ type: 'neg', arg: diffAst(node.arg) });
    }
    if (node.type === 'bin') {
      const u = node.left;
      const v = node.right;
      const du = diffAst(u);
      const dv = diffAst(v);

      if (node.op === '+') {
        return simplifyAst({ type: 'bin', op: '+', left: du, right: dv });
      }
      if (node.op === '-') {
        return simplifyAst({ type: 'bin', op: '-', left: du, right: dv });
      }
      if (node.op === '*') {
        return simplifyAst({
          type: 'bin',
          op: '+',
          left: { type: 'bin', op: '*', left: du, right: v },
          right: { type: 'bin', op: '*', left: u, right: dv },
        });
      }
      if (node.op === '/') {
        return simplifyAst({
          type: 'bin',
          op: '/',
          left: {
            type: 'bin',
            op: '-',
            left: { type: 'bin', op: '*', left: du, right: v },
            right: { type: 'bin', op: '*', left: u, right: dv },
          },
          right: { type: 'bin', op: '^', left: v, right: numNode(2) },
        });
      }
      if (node.op === '^') {
        const uHasX = hasVariableX(u);
        const vHasX = hasVariableX(v);
        if (uHasX && !vHasX) {
          return simplifyAst({
            type: 'bin',
            op: '*',
            left: {
              type: 'bin',
              op: '*',
              left: v,
              right: {
                type: 'bin',
                op: '^',
                left: u,
                right: simplifyAst({ type: 'bin', op: '-', left: v, right: numNode(1) }),
              },
            },
            right: du,
          });
        }
        if (!uHasX && vHasX) {
          return simplifyAst({
            type: 'bin',
            op: '*',
            left: {
              type: 'bin',
              op: '*',
              left: { type: 'call', name: 'ln', args: [u] },
              right: node,
            },
            right: dv,
          });
        }
        return simplifyAst({
          type: 'bin',
          op: '*',
          left: node,
          right: {
            type: 'bin',
            op: '+',
            left: {
              type: 'bin',
              op: '*',
              left: dv,
              right: { type: 'call', name: 'ln', args: [u] },
            },
            right: {
              type: 'bin',
              op: '/',
              left: { type: 'bin', op: '*', left: v, right: du },
              right: u,
            },
          },
        });
      }
    }

    if (node.type === 'call') {
      const u = node.args[0];
      const du = diffAst(u);
      const name = node.name;
      let outer = null;

      switch (name) {
        case 'sin':
          outer = { type: 'call', name: 'cos', args: [u] };
          break;
        case 'cos':
          outer = { type: 'neg', arg: { type: 'call', name: 'sin', args: [u] } };
          break;
        case 'tan':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: { type: 'bin', op: '^', left: { type: 'call', name: 'cos', args: [u] }, right: numNode(2) },
          };
          break;
        case 'exp':
          outer = { type: 'call', name: 'exp', args: [u] };
          break;
        case 'ln':
          outer = { type: 'bin', op: '/', left: numNode(1), right: u };
          break;
        case 'log':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: { type: 'bin', op: '*', left: u, right: numNode(Math.LN10) },
          };
          break;
        case 'sqrt':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: { type: 'bin', op: '*', left: numNode(2), right: { type: 'call', name: 'sqrt', args: [u] } },
          };
          break;
        case 'abs':
          outer = { type: 'call', name: 'sign', args: [u] };
          break;
        case 'asin':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: {
              type: 'call',
              name: 'sqrt',
              args: [{ type: 'bin', op: '-', left: numNode(1), right: { type: 'bin', op: '^', left: u, right: numNode(2) } }],
            },
          };
          break;
        case 'acos':
          outer = {
            type: 'neg',
            arg: {
              type: 'bin',
              op: '/',
              left: numNode(1),
              right: {
                type: 'call',
                name: 'sqrt',
                args: [{ type: 'bin', op: '-', left: numNode(1), right: { type: 'bin', op: '^', left: u, right: numNode(2) } }],
              },
            },
          };
          break;
        case 'atan':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: { type: 'bin', op: '+', left: numNode(1), right: { type: 'bin', op: '^', left: u, right: numNode(2) } },
          };
          break;
        case 'sinh':
          outer = { type: 'call', name: 'cosh', args: [u] };
          break;
        case 'cosh':
          outer = { type: 'call', name: 'sinh', args: [u] };
          break;
        case 'tanh':
          outer = {
            type: 'bin',
            op: '/',
            left: numNode(1),
            right: { type: 'bin', op: '^', left: { type: 'call', name: 'cosh', args: [u] }, right: numNode(2) },
          };
          break;
        case 'sec':
          outer = {
            type: 'bin',
            op: '*',
            left: { type: 'call', name: 'sec', args: [u] },
            right: { type: 'call', name: 'tan', args: [u] },
          };
          break;
        case 'csc':
          outer = {
            type: 'neg',
            arg: {
              type: 'bin',
              op: '*',
              left: { type: 'call', name: 'csc', args: [u] },
              right: { type: 'call', name: 'cot', args: [u] },
            },
          };
          break;
        case 'cot':
          outer = {
            type: 'neg',
            arg: {
              type: 'bin',
              op: '/',
              left: numNode(1),
              right: { type: 'bin', op: '^', left: { type: 'call', name: 'sin', args: [u] }, right: numNode(2) },
            },
          };
          break;
        default:
          return numNode(0);
      }

      return simplifyAst({ type: 'bin', op: '*', left: outer, right: du });
    }

    return numNode(0);
  }

  function compileAst(node) {
    if (node.type === 'num') {
      const val = node.value;
      return () => val;
    }
    if (node.type === 'var') {
      return (x) => x;
    }
    if (node.type === 'const') {
      const val = node.value;
      return () => val;
    }
    if (node.type === 'neg') {
      const inner = compileAst(node.arg);
      return (x) => -inner(x);
    }
    if (node.type === 'call') {
      const fn = MATH_FUNCS[node.name];
      if (node.args.length === 2) {
        const a = compileAst(node.args[0]);
        const b = compileAst(node.args[1]);
        return (x) => fn(a(x), b(x));
      }
      const a = compileAst(node.args[0]);
      return (x) => fn(a(x));
    }
    if (node.type === 'bin') {
      const l = compileAst(node.left);
      const r = compileAst(node.right);
      switch (node.op) {
        case '+':
          return (x) => l(x) + r(x);
        case '-':
          return (x) => l(x) - r(x);
        case '*':
          return (x) => l(x) * r(x);
        case '/':
          return (x) => l(x) / r(x);
        case '^':
          return (x) => Math.pow(l(x), r(x));
      }
    }
    return () => NaN;
  }

  function formatNumber(n) {
    if (Math.abs(n) < 1e-10) return '0';
    const rounded = Number(n.toFixed(4));
    return String(rounded);
  }

  function precedence(node) {
    if (!node) return 99;
    if (node.type === 'bin') {
      if (node.op === '+' || node.op === '-') return 1;
      if (node.op === '*' || node.op === '/') return 2;
      if (node.op === '^') return 4;
    }
    if (node.type === 'neg') return 3;
    return 5;
  }

  function formatAst(node, parentPrec = 0) {
    if (!node) return '';
    if (node.type === 'num') return formatNumber(node.value);
    if (node.type === 'var') return 'x';
    if (node.type === 'const') return node.name === 'pi' ? 'π' : node.name === 'tau' ? 'τ' : node.name;

    if (node.type === 'neg') {
      const inner = formatAst(node.arg, 3);
      const out = `-${inner}`;
      return parentPrec > 3 ? `(${out})` : out;
    }

    if (node.type === 'call') {
      return `${node.name}(${node.args.map((a) => formatAst(a, 0)).join(', ')})`;
    }

    if (node.type === 'bin') {
      const p = precedence(node);
      const ls = formatAst(node.left, p);
      const rs = formatAst(node.right, node.op === '-' || node.op === '/' ? p + 1 : p);
      let out;
      if (node.op === '*') {
        const lIsNum = node.left.type === 'num';
        const rCleanImplicit =
          node.right.type === 'var' ||
          node.right.type === 'const' ||
          node.right.type === 'call' ||
          (node.right.type === 'bin' && node.right.op === '^' && node.right.left.type === 'var');
        out = lIsNum && rCleanImplicit ? `${ls}${rs}` : `${ls}·${rs}`;
      } else if (node.op === '+' || node.op === '-') {
        out = `${ls} ${node.op} ${rs}`;
      } else if (node.op === '/') {
        out = `${ls} / ${rs}`;
      } else {
        out = `${ls}^${rs}`;
      }
      return p < parentPrec ? `(${out})` : out;
    }

    return '';
  }

  function compileExpression(rawExpr) {
    let cleaned = String(rawExpr || '').trim();
    cleaned = cleaned.replace(/^y\s*=\s*/i, '').replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '');
    if (!cleaned) {
      return { ok: false, error: 'Enter a formula in x' };
    }

    let tokens;
    try {
      tokens = tokenize(cleaned);
    } catch (err) {
      return { ok: false, error: err.message };
    }
    if (tokens.length === 0) {
      return { ok: false, error: 'Empty formula' };
    }

    try {
      const ast = simplifyAst(parseAst(tokens));
      const fn = compileAst(ast);
      fn(0);

      let deriv1Fn = null;
      let deriv2Fn = null;
      let deriv1Text = '';
      let deriv2Text = '';
      const symbolicOk = canDifferentiateSymbolically(ast);

      if (symbolicOk) {
        try {
          const d1Ast = diffAst(ast);
          const d2Ast = canDifferentiateSymbolically(d1Ast) ? diffAst(d1Ast) : null;
          deriv1Fn = compileAst(d1Ast);
          deriv1Text = formatAst(d1Ast);
          if (d2Ast) {
            deriv2Fn = compileAst(d2Ast);
            deriv2Text = formatAst(d2Ast);
          }
        } catch (_) {
          deriv1Fn = null;
          deriv2Fn = null;
        }
      }

      return {
        ok: true,
        fn,
        ast,
        expression: cleaned,
        symbolicOk,
        deriv1Fn,
        deriv2Fn,
        deriv1Text,
        deriv2Text,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function integrateSimpson(evalY, a, b, segments = 48) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b - a) < 1e-6) {
      return 0;
    }
    const sign = b >= a ? 1 : -1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const n = segments % 2 === 0 ? segments : segments + 1;
    const h = (hi - lo) / n;
    let sum = 0;

    for (let i = 0; i < n; i += 2) {
      const x0 = lo + i * h;
      const x1 = x0 + h;
      const x2 = x0 + 2 * h;
      const y0 = evalY(x0);
      const y1 = evalY(x1);
      const y2 = evalY(x2);
      if (Number.isFinite(y0) && Number.isFinite(y1) && Number.isFinite(y2)) {
        sum += (h / 3) * (y0 + 4 * y1 + y2);
      } else {
        // Safe midpoint fallback across discontinuities
        const ym1 = evalY(x0 + 0.5 * h);
        const ym2 = evalY(x1 + 0.5 * h);
        if (Number.isFinite(ym1)) sum += ym1 * h;
        if (Number.isFinite(ym2)) sum += ym2 * h;
      }
    }
    return Number.isFinite(sum) ? sign * sum : NaN;
  }

  MathStickGame.MathCAS = {
    compileExpression,
    integrateSimpson,
    formatNumber,
  };
})(window);
